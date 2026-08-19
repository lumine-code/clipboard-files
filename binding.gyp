{
  "targets": [
    {
      "target_name": "clipboard_files",
      "conditions": [
        [
          "OS==\"linux\"",
          {
            "type": "none"
          },
          {
            "sources": ["src/export.cc"],
            "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
            "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
            "defines": ["NAPI_CPP_EXCEPTIONS", "NAPI_VERSION=3"]
          }
        ],
        [
          "OS==\"win\"",
          {
            "sources": ["src/clipboard_win.cc"],
            "libraries": ["Shell32.lib", "Ole32.lib"],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "AdditionalOptions": ["/std:c++17"],
                "ExceptionHandling": "1"
              }
            }
          }
        ],
        [
          "OS==\"mac\"",
          {
            "sources": ["src/clipboard_mac.mm"],
            "link_settings": {
              "libraries": ["-framework AppKit"]
            },
            "xcode_settings": {
              "CLANG_ENABLE_OBJC_ARC": "YES",
              "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
              "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
              "MACOSX_DEPLOYMENT_TARGET": "11.0"
            }
          }
        ]
      ]
    }
  ]
}
