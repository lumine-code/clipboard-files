#import <AppKit/AppKit.h>
#include "clipboard.h"

// macOS has no cut-marker convention: Finder copies to the pasteboard and the
// paster chooses move at paste time. The drop effect is therefore carried as a
// custom pasteboard type on the first item - the same pattern as the
// registered "Preferred DropEffect" format on Windows. Other apps ignore the
// extra type; content they wrote reads back as a plain copy.
static NSString *const kDropEffectType = @"com.lumine-code.clipboard-files.drop-effect";

std::vector<std::string> ReadFilePaths() {
    std::vector<std::string> result;
    @autoreleasepool {
        NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
        NSArray<NSURL *> *urls = [pasteboard
            readObjectsForClasses:@[ [NSURL class] ]
                          options:@{NSPasteboardURLReadingFileURLsOnlyKey : @YES}];
        if (!urls) {
            return result;
        }
        result.reserve([urls count]);
        for (NSURL *url in urls) {
            const char *representation = [url fileSystemRepresentation];
            if (representation) {
                result.emplace_back(representation);
            }
        }
    }
    return result;
}

int ReadPreferredDropEffect() {
    @autoreleasepool {
        NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
        NSString *value = [pasteboard stringForType:kDropEffectType];
        if (value) {
            int drop_effect = (int)[value integerValue];
            if (drop_effect == DROP_EFFECT_COPY || drop_effect == DROP_EFFECT_MOVE ||
                drop_effect == DROP_EFFECT_LINK) {
                return drop_effect;
            }
        }
        BOOL has_files = [pasteboard
            canReadObjectForClasses:@[ [NSURL class] ]
                            options:@{NSPasteboardURLReadingFileURLsOnlyKey : @YES}];
        return has_files ? DROP_EFFECT_COPY : DROP_EFFECT_NONE;
    }
}

void WriteFilePaths(const std::vector<std::string> &file_paths, int drop_effect) {
    @autoreleasepool {
        NSMutableArray<NSURL *> *urls = [NSMutableArray arrayWithCapacity:file_paths.size()];
        for (const auto &path : file_paths) {
            NSString *path_string = [NSString stringWithUTF8String:path.c_str()];
            if (!path_string) {
                continue;
            }
            NSURL *url = [NSURL fileURLWithPath:path_string];
            if (url) {
                [urls addObject:url];
            }
        }

        NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
        [pasteboard clearContents];
        if ([urls count] == 0) {
            return;
        }
        // Writing NSURL objects lets AppKit bridge the legacy filenames type
        // for older consumers; the custom type is added to the first item.
        [pasteboard writeObjects:urls];
        [pasteboard addTypes:@[ kDropEffectType ] owner:nil];
        [pasteboard setString:[NSString stringWithFormat:@"%d", drop_effect]
                      forType:kDropEffectType];
    }
}

void ClearClipboard() {
    @autoreleasepool {
        [[NSPasteboard generalPasteboard] clearContents];
    }
}
