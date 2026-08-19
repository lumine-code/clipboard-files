#include <Windows.h>
#include <ShlObj.h>
#include <memory>
#include "clipboard.h"

// Convert UTF-16 wide string to UTF-8 string
std::string Utf16ToUtf8(LPCWSTR input, UINT len) {
    if (len == 0) return std::string();
    int target_len = WideCharToMultiByte(CP_UTF8, 0, input, len, NULL, 0, NULL, NULL);
    std::string result(target_len, '\0');
    WideCharToMultiByte(CP_UTF8, 0, input, len, result.data(), target_len, NULL, NULL);
    return result;
}

// Convert UTF-8 string to UTF-16 wide string
std::wstring Utf8ToUtf16(const std::string &input) {
    if (input.empty()) return std::wstring();
    int target_len = MultiByteToWideChar(CP_UTF8, 0, input.c_str(), static_cast<int>(input.size()), NULL, 0);
    std::wstring result(target_len, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, input.c_str(), static_cast<int>(input.size()), result.data(), target_len);
    return result;
}

// RAII wrapper for clipboard operations
class ClipboardScope {
    bool valid;
public:
    ClipboardScope() {
        valid = static_cast<bool>(OpenClipboard(NULL));
    }
    ~ClipboardScope() {
        if (valid) CloseClipboard();
    }
    bool IsValid() const { return valid; }
};

// Convert long path to short path (for paths > MAX_PATH)
std::wstring LongPathToShort(const std::wstring &long_path) {
    const WCHAR *prefix = L"\\\\?\\";
    std::wstring prefixed_long_path = prefix + long_path;
    DWORD buffer_size = GetShortPathNameW(prefixed_long_path.c_str(), NULL, 0);
    if (buffer_size == 0) return long_path; // Return original if conversion fails
    auto buffer_pointer = std::unique_ptr<WCHAR[]>(new WCHAR[buffer_size]);
    GetShortPathNameW(prefixed_long_path.c_str(), buffer_pointer.get(), buffer_size);
    size_t offset = wcslen(prefix);
    return buffer_pointer.get() + offset;
}

// Registered clipboard format for preferred drop effect
static UINT GetPreferredDropEffectFormat() {
    static UINT format = RegisterClipboardFormatW(L"Preferred DropEffect");
    return format;
}

std::vector<std::string> ReadFilePaths() {
    std::vector<std::string> result;

    ClipboardScope clipboard_scope;
    if (!clipboard_scope.IsValid()) {
        return result;
    }

    HDROP drop_files_handle = static_cast<HDROP>(GetClipboardData(CF_HDROP));
    if (!drop_files_handle) {
        return result;
    }

    UINT file_count = DragQueryFileW(drop_files_handle, 0xFFFFFFFF, NULL, 0);
    result.reserve(file_count);

    for (UINT i = 0; i < file_count; ++i) {
        UINT path_len = DragQueryFileW(drop_files_handle, i, NULL, 0);
        UINT buffer_len = path_len + 1;
        std::unique_ptr<WCHAR[]> buffer(new WCHAR[buffer_len]);
        path_len = DragQueryFileW(drop_files_handle, i, buffer.get(), buffer_len);
        result.emplace_back(Utf16ToUtf8(buffer.get(), path_len));
    }

    return result;
}

int ReadPreferredDropEffect() {
    ClipboardScope clipboard_scope;
    if (!clipboard_scope.IsValid()) {
        return DROP_EFFECT_NONE;
    }

    UINT format = GetPreferredDropEffectFormat();
    HANDLE data_handle = GetClipboardData(format);
    if (!data_handle) {
        return DROP_EFFECT_NONE;
    }

    DWORD *data_pointer = static_cast<DWORD*>(GlobalLock(data_handle));
    if (!data_pointer) {
        return DROP_EFFECT_NONE;
    }

    int drop_effect = static_cast<int>(*data_pointer);
    GlobalUnlock(data_handle);

    return drop_effect;
}

void WriteFilePaths(const std::vector<std::string> &file_paths, int drop_effect) {
    // Convert all paths to UTF-16
    std::vector<std::wstring> file_paths_unicode;
    file_paths_unicode.reserve(file_paths.size());

    for (const auto &path : file_paths) {
        std::wstring path_unicode = Utf8ToUtf16(path);
        if (path_unicode.size() > MAX_PATH) {
            path_unicode = LongPathToShort(path_unicode);
        }
        file_paths_unicode.emplace_back(path_unicode);
    }

    // Calculate size of DROPFILES structure + file paths (double null-terminated)
    SIZE_T structure_size = sizeof(DROPFILES);
    for (const auto &path : file_paths_unicode) {
        structure_size += (path.size() + 1) * sizeof(WCHAR);
    }
    structure_size += sizeof(WCHAR); // Final null terminator

    // Allocate memory for CF_HDROP data
    HANDLE hdrop_handle = GlobalAlloc(GMEM_MOVEABLE, structure_size);
    if (!hdrop_handle) {
        return;
    }

    BYTE *data_pointer = static_cast<BYTE*>(GlobalLock(hdrop_handle));
    if (!data_pointer) {
        GlobalFree(hdrop_handle);
        return;
    }

    // Fill DROPFILES structure
    DROPFILES *drop_files = reinterpret_cast<DROPFILES*>(data_pointer);
    drop_files->pFiles = sizeof(DROPFILES);
    drop_files->pt.x = 0;
    drop_files->pt.y = 0;
    drop_files->fNC = FALSE;
    drop_files->fWide = TRUE;

    // Copy file paths
    SIZE_T current_offset = sizeof(DROPFILES);
    for (const auto &path : file_paths_unicode) {
        WCHAR *target = reinterpret_cast<WCHAR*>(data_pointer + current_offset);
        SIZE_T path_bytes = (path.size() + 1) * sizeof(WCHAR);
        memcpy(target, path.c_str(), path_bytes);
        current_offset += path_bytes;
    }

    // Add final null terminator
    WCHAR *tail = reinterpret_cast<WCHAR*>(data_pointer + current_offset);
    *tail = L'\0';

    GlobalUnlock(hdrop_handle);

    // Allocate memory for preferred drop effect
    HANDLE effect_handle = GlobalAlloc(GMEM_MOVEABLE, sizeof(DWORD));
    if (!effect_handle) {
        GlobalFree(hdrop_handle);
        return;
    }

    DWORD *effect_pointer = static_cast<DWORD*>(GlobalLock(effect_handle));
    if (!effect_pointer) {
        GlobalFree(hdrop_handle);
        GlobalFree(effect_handle);
        return;
    }

    *effect_pointer = static_cast<DWORD>(drop_effect);
    GlobalUnlock(effect_handle);

    // Set clipboard data
    ClipboardScope clipboard_scope;
    if (!clipboard_scope.IsValid()) {
        GlobalFree(hdrop_handle);
        GlobalFree(effect_handle);
        return;
    }

    EmptyClipboard();

    if (!SetClipboardData(CF_HDROP, hdrop_handle)) {
        GlobalFree(hdrop_handle);
        GlobalFree(effect_handle);
        return;
    }

    UINT effect_format = GetPreferredDropEffectFormat();
    if (!SetClipboardData(effect_format, effect_handle)) {
        GlobalFree(effect_handle);
        return;
    }
}

void ClearClipboard() {
    ClipboardScope clipboard_scope;
    if (!clipboard_scope.IsValid()) {
        return;
    }
    EmptyClipboard();
}
