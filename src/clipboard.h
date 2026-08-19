#ifndef WINDOWS_CLIP_CLIPBOARD_H
#define WINDOWS_CLIP_CLIPBOARD_H

#include <vector>
#include <string>

// Drop effect constants (matching Windows DROPEFFECT values)
constexpr int DROP_EFFECT_NONE = 0;
constexpr int DROP_EFFECT_COPY = 1;
constexpr int DROP_EFFECT_MOVE = 2;
constexpr int DROP_EFFECT_LINK = 4;

// Read file paths from clipboard (CF_HDROP format)
std::vector<std::string> ReadFilePaths();

// Write file paths to clipboard with specified drop effect
// drop_effect: DROP_EFFECT_COPY for copy, DROP_EFFECT_MOVE for cut
void WriteFilePaths(const std::vector<std::string> &file_paths, int drop_effect);

// Read the preferred drop effect from clipboard
// Returns DROP_EFFECT_NONE if not set, DROP_EFFECT_COPY for copy, DROP_EFFECT_MOVE for cut
int ReadPreferredDropEffect();

// Clear the clipboard
void ClearClipboard();

#endif // WINDOWS_CLIP_CLIPBOARD_H
