#include <napi.h>
#include "clipboard.h"

// Read file paths from clipboard
Napi::Array ReadFilePathsJs(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    const auto file_paths = ReadFilePaths();
    auto result = Napi::Array::New(env, file_paths.size());

    for (size_t i = 0; i < file_paths.size(); ++i) {
        result.Set(i, Napi::String::New(env, file_paths[i]));
    }

    return result;
}

// Read preferred drop effect from clipboard
// Returns: 0 = none, 1 = copy, 2 = move/cut, 4 = link
Napi::Number ReadDropEffectJs(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    int drop_effect = ReadPreferredDropEffect();
    return Napi::Number::New(env, drop_effect);
}

// Write file paths to clipboard with drop effect
// Args: filePaths (string[]), dropEffect (number: 1=copy, 2=cut/move)
Napi::Value WriteFilePathsJs(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected 2 arguments: filePaths (string[]) and dropEffect (number)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsArray()) {
        Napi::TypeError::New(env, "First argument must be an array of file paths")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[1].IsNumber()) {
        Napi::TypeError::New(env, "Second argument must be a number (drop effect)")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    auto file_paths_js = info[0].As<Napi::Array>();
    int drop_effect = info[1].As<Napi::Number>().Int32Value();

    std::vector<std::string> file_paths;
    file_paths.reserve(file_paths_js.Length());

    for (uint32_t i = 0; i < file_paths_js.Length(); ++i) {
        Napi::Value val = file_paths_js.Get(i);
        if (!val.IsString()) {
            Napi::TypeError::New(env, "All file paths must be strings")
                .ThrowAsJavaScriptException();
            return env.Null();
        }
        std::string path = val.As<Napi::String>().Utf8Value();
        if (path.empty()) {
            Napi::TypeError::New(env, "Empty path is not allowed")
                .ThrowAsJavaScriptException();
            return env.Null();
        }
        file_paths.emplace_back(path);
    }

    WriteFilePaths(file_paths, drop_effect);
    return env.Undefined();
}

// Clear clipboard
void ClearClipboardJs(const Napi::CallbackInfo &info) {
    ClearClipboard();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Export drop effect constants
    exports.Set("DROP_EFFECT_NONE", Napi::Number::New(env, DROP_EFFECT_NONE));
    exports.Set("DROP_EFFECT_COPY", Napi::Number::New(env, DROP_EFFECT_COPY));
    exports.Set("DROP_EFFECT_MOVE", Napi::Number::New(env, DROP_EFFECT_MOVE));
    exports.Set("DROP_EFFECT_LINK", Napi::Number::New(env, DROP_EFFECT_LINK));

    // Export functions
    exports.Set("readFilePaths", Napi::Function::New(env, ReadFilePathsJs));
    exports.Set("readDropEffect", Napi::Function::New(env, ReadDropEffectJs));
    exports.Set("writeFilePaths", Napi::Function::New(env, WriteFilePathsJs));
    exports.Set("clear", Napi::Function::New(env, ClearClipboardJs));

    return exports;
}

NODE_API_MODULE(clipboard, Init)
