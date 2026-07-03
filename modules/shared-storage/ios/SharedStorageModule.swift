import ExpoModulesCore

public class SharedStorageModule: Module {
  private let appGroupId = "group.ch.meteoblick"

  public func definition() -> ModuleDefinition {
    Name("SharedStorage")

    AsyncFunction("getItem") { (key: String) -> String? in
      let defaults = UserDefaults(suiteName: appGroupId)
      return defaults?.string(forKey: key)
    }

    AsyncFunction("setItem") { (key: String, value: String) in
      let defaults = UserDefaults(suiteName: appGroupId)
      defaults?.set(value, forKey: key)
      defaults?.synchronize()
    }
  }
}
