import Foundation
import Speech
import AVFoundation

/// Protocolo línea a línea por stdin/stdout (JSON en stdout).
/// Comandos: START <locale> | STOP | QUIT

enum OutEvent: Encodable {
  case ready
  case started
  case partial(text: String)
  case finalText(text: String)
  case stopped
  case error(code: String, message: String)

  enum CodingKeys: String, CodingKey {
    case type, text, code, message
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
    case .finalText(let text):
      try c.encode("final", forKey: .type)
      try c.encode(text, forKey: .text)
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

final class DictationEngine: NSObject {
  private let audioEngine = AVAudioEngine()
  private var recognizer: SFSpeechRecognizer?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var bestTranscript = ""
  private var running = false
  private var awaitingFinal = false
  private var stopCompletion: ((String) -> Void)?
  private let lock = NSLock()
  /// Espera tras endAudio a un resultado isFinal antes de cancelar.
  private let stopFinalizeTimeoutMs: Int = 700

  func start(localeIdentifier: String, completion: @escaping (Bool, String?) -> Void) {
    lock.lock()
    if running || awaitingFinal {
      lock.unlock()
      completion(false, "already-running")
      return
    }
    lock.unlock()

    requestMicAndSpeech { [weak self] ok, err in
      guard let self else { return }
      if !ok {
        completion(false, err ?? "permission-denied")
        return
      }
      DispatchQueue.main.async {
        do {
          try self.beginRecognition(localeIdentifier: localeIdentifier)
          logErr("start ok locale=\(localeIdentifier)")
          completion(true, nil)
        } catch {
          logErr("start failed: \(error.localizedDescription)")
          completion(false, "start-failed")
        }
      }
    }
  }

  /// Termina el audio, espera resultado final (o timeout) y entrega bestTranscript.
  func stop(completion: @escaping (String) -> Void) {
    lock.lock()
    let wasRunning = running
    let alreadyAwaiting = awaitingFinal
    running = false
    lock.unlock()

    if alreadyAwaiting {
      // STOP duplicado: encolar tras el pendiente.
      let previous = stopCompletion
      stopCompletion = { text in
        previous?(text)
        completion(text)
      }
      return
    }

    if !wasRunning {
      let text = normalizeTranscript(bestTranscript)
      logErr("stop idle chars=\(text.count)")
      completion(text)
      return
    }

    logErr("stop begin chars=\(bestTranscript.count)")
    awaitingFinal = true
    stopCompletion = completion

    // 1) Dejar de capturar; 2) endAudio para que el recognizer finalice (NO cancel).
    if audioEngine.isRunning {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
    }
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
    logErr("stop done reason=\(reason) chars=\(text.count)")

    task = nil
    request = nil
    recognizer = nil
    cb?(text)
  }

  private func beginRecognition(localeIdentifier: String) throws {
    bestTranscript = ""
    awaitingFinal = false
    stopCompletion = nil

    let locale = Locale(identifier: localeIdentifier)
    guard let recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer() else {
      throw NSError(domain: "gravity.dictation", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "SFSpeechRecognizer unavailable",
      ])
    }
    self.recognizer = recognizer
    if !recognizer.isAvailable {
      throw NSError(domain: "gravity.dictation", code: 2, userInfo: [
        NSLocalizedDescriptionKey: "recognizer not available",
      ])
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    // Solo on-device cuando el runtime lo soporta; si no hay modelo, no forzar.
    if recognizer.supportsOnDeviceRecognition {
      request.requiresOnDeviceRecognition = true
      logErr("on-device recognition enabled")
    } else {
      request.requiresOnDeviceRecognition = false
      logErr("on-device recognition unavailable; using default")
    }
    self.request = request

    // Formato de hardware del mic (evita outputFormat con 0 channels antes de arrancar).
    audioEngine.prepare()
    let input = audioEngine.inputNode
    let format = input.inputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      logErr("invalid input format rate=\(format.sampleRate) channels=\(format.channelCount)")
      throw NSError(domain: "gravity.dictation", code: 3, userInfo: [
        NSLocalizedDescriptionKey: "invalid audio input format",
      ])
    }
    logErr("audio format rate=\(Int(format.sampleRate)) channels=\(Int(format.channelCount))")

    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }
    try audioEngine.start()

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
        // Cancelación voluntaria / fin de audio: no es error de UX.
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

  private func requestMicAndSpeech(completion: @escaping (Bool, String?) -> Void) {
    SFSpeechRecognizer.requestAuthorization { status in
      guard status == .authorized else {
        logErr("speech auth=\(status.rawValue)")
        completion(false, "permission-denied")
        return
      }
      Self.requestMicrophone { micOk in
        if !micOk { logErr("mic permission denied") }
        completion(micOk, micOk ? nil : "permission-denied")
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
        emit(.error(code: err ?? "start-failed", message: err ?? "start-failed"))
      }
    }
  case "STOP":
    engine.stop { text in
      emit(.finalText(text: text))
      emit(.stopped)
    }
  case "QUIT":
    engine.stop { _ in
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
