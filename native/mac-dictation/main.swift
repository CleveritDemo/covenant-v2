import Foundation
import Speech
import AVFoundation

/// Protocolo línea a línea por stdin/stdout (JSON en stdout).
/// Comandos: START <locale> | STOP | QUIT
///
/// Contrato STOP:
/// - Con texto → `{"type":"final","text":"...","peak":N}` luego `stopped`.
/// - Sin texto y peak < umbral → `error` code `no-audio` (mic silencioso / input vacío).
/// - Sin texto y peak OK → `final` con text vacío (renderer → no-speech); no es fallo de mic.

/// Pico abs. mínimo (PCM float) para considerar que hubo captura de mic.
let silencePeakThreshold: Float = 0.008
/// Intervalo mínimo entre eventos `level` (~25/s, bajo el tope de ~40/s).
let levelEmitIntervalSec: CFAbsoluteTime = 0.04

private let spectrumBandCount = 12
private let spectrumTargetHz: [Float] = [
  100, 150, 220, 330, 500, 750, 1100, 1700, 2500, 3800, 5500, 8000,
]

enum OutEvent: Encodable {
  case ready
  case started
  case partial(text: String)
  case level(peak: Float, bands: [Float])
  case finalText(text: String, peak: Float)
  case stopped
  case error(code: String, message: String)

  enum CodingKeys: String, CodingKey {
    case type, text, code, message, peak, bands
  }

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case .ready:
      try c.encode("ready", forKey: .type)
    case .started:
      try c.encode("started", forKey: .type)
    case .partial(let text):
      try c.encode("partial", forKey: .type)
      try c.encode(text, forKey: .text)
    case .level(let peak, let bands):
      try c.encode("level", forKey: .type)
      try c.encode(peak, forKey: .peak)
      try c.encode(bands, forKey: .bands)
    case .finalText(let text, let peak):
      try c.encode("final", forKey: .type)
      try c.encode(text, forKey: .text)
      try c.encode(peak, forKey: .peak)
    case .stopped:
      try c.encode("stopped", forKey: .type)
    case .error(let code, let message):
      try c.encode("error", forKey: .type)
      try c.encode(code, forKey: .code)
      try c.encode(message, forKey: .message)
    }
  }
}

func emit(_ event: OutEvent) {
  let enc = JSONEncoder()
  guard let data = try? enc.encode(event),
        let line = String(data: data, encoding: .utf8) else { return }
  fputs(line + "\n", stdout)
  fflush(stdout)
}

func logErr(_ message: String) {
  fputs("[mac-dictation] \(message)\n", stderr)
  fflush(stderr)
}

func normalizeTranscript(_ raw: String) -> String {
  raw
    .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    .trimmingCharacters(in: .whitespacesAndNewlines)
}

/// Pico absoluto de un buffer PCM (float). Extraíble para tests / espejo TS.
func peakAbsoluteFromBuffer(_ buffer: AVAudioPCMBuffer) -> Float {
  let frames = Int(buffer.frameLength)
  guard frames > 0, let channels = buffer.floatChannelData else { return 0 }
  let channelCount = Int(buffer.format.channelCount)
  var peak: Float = 0
  for ch in 0..<channelCount {
    let samples = channels[ch]
    for i in 0..<frames {
      let v = abs(samples[i])
      if v > peak { peak = v }
    }
  }
  return peak
}

func isSilentPeak(_ peak: Float, threshold: Float = silencePeakThreshold) -> Bool {
  !peak.isFinite || peak < threshold
}

func goertzelMagnitude(
  samples: UnsafePointer<Float>,
  count: Int,
  sampleRate: Float,
  targetHz: Float
) -> Float {
  guard count > 0, sampleRate > 0, targetHz > 0 else { return 0 }
  let k = Int(0.5 + (Float(count) * targetHz / sampleRate))
  let omega = (2.0 * Float.pi * Float(k)) / Float(count)
  let coeff = 2.0 * cos(omega)
  var s0: Float = 0
  var s1: Float = 0
  var s2: Float = 0
  for i in 0..<count {
    s0 = samples[i] + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  let power = s1 * s1 + s2 * s2 - coeff * s1 * s2
  return sqrt(max(0, power)) / Float(count)
}

func spectrumBands(from buffer: AVAudioPCMBuffer) -> [Float] {
  let frames = Int(buffer.frameLength)
  guard frames >= 32, let channelData = buffer.floatChannelData else {
    return [Float](repeating: 0, count: spectrumBandCount)
  }
  let count = min(frames, 1024)
  let rate = Float(buffer.format.sampleRate)
  let samples = channelData[0]
  return spectrumTargetHz.map { hz in
    let magnitude = goertzelMagnitude(
      samples: samples,
      count: count,
      sampleRate: rate,
      targetHz: hz
    )
    return min(1, max(0, magnitude * 42))
  }
}

enum DictationStartError: String {
  case alreadyRunning = "already-running"
  case permissionDenied = "permission-denied"
  case startFailed = "start-failed"
  case audioFailed = "audio-failed"
  case unsupported = "unsupported"
}

final class DictationEngine: NSObject {
  /// Se recrea tras fallos: un engine tras NSException en prepare puede quedar inválido.
  private var audioEngine = AVAudioEngine()
  private var recognizer: SFSpeechRecognizer?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var bestTranscript = ""
  private var sessionPeak: Float = 0
  /// Max pico desde el último `level` emitido (ventana para waveform).
  private var levelWindowPeak: Float = 0
  private var levelWindowBands = [Float](repeating: 0, count: spectrumBandCount)
  private var lastLevelEmitAt: CFAbsoluteTime = 0
  private var running = false
  private var awaitingFinal = false
  /// (text, peak, optionalErrorCode) — errorCode p.ej. no-audio
  private var stopCompletion: ((String, Float, String?) -> Void)?
  private let lock = NSLock()
  private let stopFinalizeTimeoutMs: Int = 700

  func start(localeIdentifier: String, completion: @escaping (Bool, String?) -> Void) {
    lock.lock()
    if running || awaitingFinal {
      lock.unlock()
      completion(false, DictationStartError.alreadyRunning.rawValue)
      return
    }
    lock.unlock()

    requestMicAndSpeech { [weak self] ok, err in
      guard let self else { return }
      if !ok {
        completion(false, err ?? DictationStartError.permissionDenied.rawValue)
        return
      }
      DispatchQueue.main.async {
        do {
          try self.beginRecognition(localeIdentifier: localeIdentifier)
          logErr("start ok locale=\(localeIdentifier)")
          completion(true, nil)
        } catch let err as NSError {
          let code = err.domain == "gravity.dictation"
            ? (err.userInfo[NSLocalizedFailureReasonErrorKey] as? String
              ?? DictationStartError.startFailed.rawValue)
            : DictationStartError.audioFailed.rawValue
          logErr("start failed code=\(code) msg=\(err.localizedDescription)")
          self.teardownAudio(resetEngine: true)
          completion(false, code)
        } catch {
          logErr("start failed: \(error.localizedDescription)")
          self.teardownAudio(resetEngine: true)
          completion(false, DictationStartError.startFailed.rawValue)
        }
      }
    }
  }

  func stop(completion: @escaping (String, Float, String?) -> Void) {
    lock.lock()
    let wasRunning = running
    let alreadyAwaiting = awaitingFinal
    running = false
    lock.unlock()

    if alreadyAwaiting {
      let previous = stopCompletion
      stopCompletion = { text, peak, code in
        previous?(text, peak, code)
        completion(text, peak, code)
      }
      return
    }

    if !wasRunning {
      let text = normalizeTranscript(bestTranscript)
      let peak = sessionPeak
      logErr("stop idle chars=\(text.count) peak=\(String(format: "%.6f", peak))")
      completion(text, peak, classifyEmptyStop(text: text, peak: peak))
      return
    }

    logErr("stop begin chars=\(bestTranscript.count) peak=\(String(format: "%.6f", sessionPeak))")
    awaitingFinal = true
    stopCompletion = completion

    stopAudioCapture()
    request?.endAudio()

    let timeout = DispatchTime.now() + .milliseconds(stopFinalizeTimeoutMs)
    DispatchQueue.main.asyncAfter(deadline: timeout) { [weak self] in
      guard let self else { return }
      self.lock.lock()
      let stillWaiting = self.awaitingFinal
      self.lock.unlock()
      guard stillWaiting else { return }
      logErr("stop timeout fallback chars=\(self.bestTranscript.count)")
      self.task?.cancel()
      self.finishStop(reason: "timeout")
    }
  }

  private func classifyEmptyStop(text: String, peak: Float) -> String? {
    if !text.isEmpty { return nil }
    if isSilentPeak(peak) { return "no-audio" }
    // Energía OK sin palabras: el runtime/renderer trata final vacío como no-speech.
    return nil
  }

  private func finishStop(reason: String) {
    lock.lock()
    guard awaitingFinal || stopCompletion != nil else {
      lock.unlock()
      return
    }
    awaitingFinal = false
    let cb = stopCompletion
    stopCompletion = nil
    lock.unlock()

    let text = normalizeTranscript(bestTranscript)
    let peak = sessionPeak
    let errCode = classifyEmptyStop(text: text, peak: peak)
    logErr(
      "stop done reason=\(reason) chars=\(text.count) peak=\(String(format: "%.6f", peak))"
        + (errCode.map { " code=\($0)" } ?? "")
    )
    teardownAudio(resetEngine: false)
    cb?(text, peak, errCode)
  }

  private func beginRecognition(localeIdentifier: String) throws {
    bestTranscript = ""
    sessionPeak = 0
    levelWindowPeak = 0
    levelWindowBands = [Float](repeating: 0, count: spectrumBandCount)
    lastLevelEmitAt = 0
    awaitingFinal = false
    stopCompletion = nil
    teardownAudio(resetEngine: true)

    let locale = Locale(identifier: localeIdentifier)
    guard let recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer() else {
      throw dictationError(code: .unsupported, message: "SFSpeechRecognizer unavailable")
    }
    self.recognizer = recognizer
    if !recognizer.isAvailable {
      throw dictationError(code: .unsupported, message: "recognizer not available")
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    // No forzar on-device: con modelo incompleto suele devolver vacío pese a audio audible.
    // Reconocimiento por defecto (servidor cuando aplica) es más fiable para push-to-talk.
    request.requiresOnDeviceRecognition = false
    if recognizer.supportsOnDeviceRecognition {
      logErr("on-device available but not forced (prefer default ASR)")
    } else {
      logErr("using default recognition")
    }
    self.request = request

    let engine = audioEngine
    let input = engine.inputNode

    // Validar formato ANTES de start/prepare (prepare lanza NSException no capturable por Swift).
    let format = input.inputFormat(forBus: 0)
    guard isValidAudioFormat(format) else {
      logErr("invalid input format rate=\(format.sampleRate) channels=\(format.channelCount)")
      throw dictationError(code: .audioFailed, message: "invalid audio input format")
    }
    logErr("audio format rate=\(Int(format.sampleRate)) channels=\(Int(format.channelCount))")

    // No llamar prepare(): en algunos macOS Initialize lanza NSException → SIGABRT.
    input.removeTap(onBus: 0)

    var installEx: NSException?
    let installed = GravityCatchException({
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
        guard let self else { return }
        let peak = peakAbsoluteFromBuffer(buffer)
        let bands = spectrumBands(from: buffer)
        self.lock.lock()
        if peak > self.sessionPeak { self.sessionPeak = peak }
        if peak > self.levelWindowPeak { self.levelWindowPeak = peak }
        for index in 0..<spectrumBandCount {
          if bands[index] > self.levelWindowBands[index] {
            self.levelWindowBands[index] = bands[index]
          }
        }
        var emitPeak: Float?
        var emitBands: [Float]?
        let now = CFAbsoluteTimeGetCurrent()
        if self.running && (self.lastLevelEmitAt == 0 || now - self.lastLevelEmitAt >= levelEmitIntervalSec) {
          self.lastLevelEmitAt = now
          emitPeak = self.levelWindowPeak
          emitBands = self.levelWindowBands
          self.levelWindowPeak = 0
          self.levelWindowBands = [Float](repeating: 0, count: spectrumBandCount)
        }
        self.lock.unlock()
        if let emitPeak, let emitBands {
          emit(.level(peak: emitPeak, bands: emitBands))
        }
        self.request?.append(buffer)
      }
    }, &installEx)
    if !installed {
      let reason = installEx?.reason ?? "installTap failed"
      logErr("installTap NSException: \(reason)")
      throw dictationError(code: .audioFailed, message: reason)
    }

    var startError: NSError?
    var startEx: NSException?
    let started = GravityCatchException({
      do {
        try engine.start()
      } catch {
        startError = error as NSError
      }
    }, &startEx)

    if let startEx {
      logErr("engine.start NSException: \(startEx.reason ?? "?")")
      input.removeTap(onBus: 0)
      throw dictationError(code: .audioFailed, message: startEx.reason ?? "AVAudioEngine start exception")
    }
    if !started {
      input.removeTap(onBus: 0)
      throw dictationError(code: .audioFailed, message: "AVAudioEngine start aborted")
    }
    if let startError {
      logErr("engine.start error: \(startError.localizedDescription)")
      input.removeTap(onBus: 0)
      throw dictationError(code: .audioFailed, message: startError.localizedDescription)
    }

    lock.lock()
    running = true
    lock.unlock()

    task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else { return }
      if let result {
        let text = result.bestTranscription.formattedString
        self.bestTranscript = text
        emit(.partial(text: text))
        if result.isFinal {
          self.lock.lock()
          let waiting = self.awaitingFinal
          self.lock.unlock()
          if waiting {
            self.finishStop(reason: "final")
          }
        }
      }
      if let error {
        let ns = error as NSError
        if ns.domain == "kAFAssistantErrorDomain", ns.code == 216 { return }
        if ns.code == 1 || ns.localizedDescription.lowercased().contains("cancel") { return }
        self.lock.lock()
        let waiting = self.awaitingFinal
        self.lock.unlock()
        if waiting {
          logErr("recognition error during stop code=\(ns.code)")
          self.finishStop(reason: "error")
        }
      }
    }
  }

  private func isValidAudioFormat(_ format: AVAudioFormat) -> Bool {
    format.sampleRate > 0 && format.channelCount > 0
  }

  private func dictationError(code: DictationStartError, message: String) -> NSError {
    NSError(domain: "gravity.dictation", code: 1, userInfo: [
      NSLocalizedDescriptionKey: message,
      NSLocalizedFailureReasonErrorKey: code.rawValue,
    ])
  }

  private func stopAudioCapture() {
    if audioEngine.isRunning {
      audioEngine.stop()
    }
    var ex: NSException?
    _ = GravityCatchException({
      self.audioEngine.inputNode.removeTap(onBus: 0)
    }, &ex)
    if let ex {
      logErr("removeTap: \(ex.reason ?? "?")")
    }
  }

  private func teardownAudio(resetEngine: Bool) {
    stopAudioCapture()
    task?.cancel()
    task = nil
    request = nil
    recognizer = nil
    if resetEngine {
      audioEngine = AVAudioEngine()
      logErr("audio engine reset")
    }
  }

  private func requestMicAndSpeech(completion: @escaping (Bool, String?) -> Void) {
    SFSpeechRecognizer.requestAuthorization { status in
      guard status == .authorized else {
        logErr("speech auth=\(status.rawValue)")
        completion(false, DictationStartError.permissionDenied.rawValue)
        return
      }
      Self.requestMicrophone { micOk in
        if !micOk { logErr("mic permission denied") }
        completion(micOk, micOk ? nil : DictationStartError.permissionDenied.rawValue)
      }
    }
  }

  private static func requestMicrophone(completion: @escaping (Bool) -> Void) {
    if #available(macOS 14.0, *) {
      AVAudioApplication.requestRecordPermission { granted in
        completion(granted)
      }
      return
    }
    AVCaptureDevice.requestAccess(for: .audio) { granted in
      completion(granted)
    }
  }
}

let engine = DictationEngine()

emit(.ready)
logErr("helper ready")

func handleLine(_ raw: String) {
  let line = raw.trimmingCharacters(in: .whitespacesAndNewlines)
  if line.isEmpty { return }
  let parts = line.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
  let cmd = parts.first.map(String.init)?.uppercased() ?? ""
  let arg = parts.count > 1 ? String(parts[1]) : ""

  switch cmd {
  case "START":
    let locale = arg.isEmpty ? "en-US" : arg
    engine.start(localeIdentifier: locale) { ok, err in
      if ok {
        emit(.started)
      } else {
        let code = err ?? DictationStartError.startFailed.rawValue
        emit(.error(code: code, message: code))
      }
    }
  case "STOP":
    engine.stop { text, peak, errCode in
      if let errCode {
        emit(.error(
          code: errCode,
          message: "\(errCode) peak=\(String(format: "%.6f", peak)) threshold=\(String(format: "%.6f", silencePeakThreshold))"
        ))
      } else {
        emit(.finalText(text: text, peak: peak))
      }
      emit(.stopped)
    }
  case "QUIT":
    engine.stop { _, _, _ in
      exit(0)
    }
  default:
    emit(.error(code: "bad-command", message: "Unknown command: \(cmd)"))
  }
}

class StdinReader: NSObject {
  private var buffer = Data()

  func start() {
    FileHandle.standardInput.readabilityHandler = { [weak self] handle in
      let chunk = handle.availableData
      if chunk.isEmpty {
        handle.readabilityHandler = nil
        exit(0)
      }
      self?.buffer.append(chunk)
      self?.drain()
    }
  }

  private func drain() {
    while let range = buffer.range(of: Data([0x0A])) {
      let lineData = buffer.subdata(in: buffer.startIndex..<range.lowerBound)
      buffer.removeSubrange(buffer.startIndex...range.lowerBound)
      if let line = String(data: lineData, encoding: .utf8) {
        DispatchQueue.main.async {
          handleLine(line)
        }
      }
    }
  }
}

let reader = StdinReader()
reader.start()
RunLoop.main.run()
