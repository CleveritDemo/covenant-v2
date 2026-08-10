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

final class DictationEngine: NSObject {
  private let audioEngine = AVAudioEngine()
  private var recognizer: SFSpeechRecognizer?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var bestTranscript = ""
  private var running = false
  private let lock = NSLock()

  var isRunning: Bool {
    lock.lock(); defer { lock.unlock() }
    return running
  }

  func start(localeIdentifier: String, completion: @escaping (Bool, String?) -> Void) {
    lock.lock()
    if running {
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
          completion(true, nil)
        } catch {
          completion(false, "start-failed")
        }
      }
    }
  }

  func stop() -> String {
    lock.lock()
    let wasRunning = running
    running = false
    lock.unlock()
    if !wasRunning {
      return bestTranscript
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    let text = bestTranscript
      .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)

    task?.cancel()
    task = nil
    request?.endAudio()
    request = nil
    if audioEngine.isRunning {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
    }
    try? AVAudioSessionPlaceholder.deactivate()
    return text
  }

  private func beginRecognition(localeIdentifier: String) throws {
    bestTranscript = ""
    let locale = Locale(identifier: localeIdentifier)
    guard let recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer() else {
      throw NSError(domain: "gravity.dictation", code: 1)
    }
    self.recognizer = recognizer
    if !recognizer.isAvailable {
      throw NSError(domain: "gravity.dictation", code: 2)
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    if recognizer.supportsOnDeviceRecognition {
      request.requiresOnDeviceRecognition = true
    }
    self.request = request

    let input = audioEngine.inputNode
    let format = input.outputFormat(forBus: 0)
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }

    audioEngine.prepare()
    try audioEngine.start()

    lock.lock()
    running = true
    lock.unlock()

    task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else { return }
      if let result {
        let text = result.bestTranscription.formattedString
        self.bestTranscript = text
        if result.isFinal {
          emit(.partial(text: text))
        } else {
          emit(.partial(text: text))
        }
      }
      if error != nil {
        // STOP del cliente cancela la task; no emitir error de red/cancel.
      }
    }
  }

  private func requestMicAndSpeech(completion: @escaping (Bool, String?) -> Void) {
    SFSpeechRecognizer.requestAuthorization { status in
      guard status == .authorized else {
        completion(false, "permission-denied")
        return
      }
      Self.requestMicrophone { micOk in
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

/// AVAudioSession no existe en macOS clásico; placeholder no-op para simetría.
enum AVAudioSessionPlaceholder {
  static func deactivate() throws {}
}

let engine = DictationEngine()

emit(.ready)

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
    let text = engine.stop()
    emit(.finalText(text: text))
    emit(.stopped)
  case "QUIT":
    _ = engine.stop()
    exit(0)
  default:
    emit(.error(code: "bad-command", message: "Unknown command: \(cmd)"))
  }
}

// Lectura no bloqueante de stdin por líneas
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
