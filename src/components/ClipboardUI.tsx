import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Alert,
  createTheme,
  ThemeProvider,
  CssBaseline,
  useMediaQuery,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";
import DescriptionIcon from "@mui/icons-material/Description";
import ClearIcon from "@mui/icons-material/Clear";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

// Import Tauri v2 APIs
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Clipboard Item structure
interface ClipboardItem {
  id: string;
  type: "code" | "link" | "color" | "text";
  content: string;
  meta: string;
  copiedAt: number;
}

// Utility to calculate relative time
function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 2000) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Utility to detect clipboard item types
function detectItemType(content: string): "code" | "link" | "color" | "text" {
  const trimmed = content.trim();

  // 1. Color check
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return "color";
  }

  // 2. Link check
  if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(trimmed)) {
    return "link";
  }

  // 3. Code syntax check
  const codePatterns = [
    /const\s+\w+\s*=/, /let\s+\w+\s*=/, /var\s+\w+\s*=/,
    /function\s+\w+\s*\(/, /fn\s+\w+\s*\(/, /class\s+\w+/,
    /import\s+[\s\S]*?\s+from/, /export\s+/, /package\s+/,
    /public\s+class\s+/, /println!/, /console\.log\(/,
    /\{\s*[\s\S]*\}\s*$/, /<\/?[a-z][\s\S]*>/i
  ];
  if (codePatterns.some((pattern) => pattern.test(trimmed))) {
    return "code";
  }

  return "text";
}

// Utility to generate nice metadata descriptive strings
function getItemMeta(content: string, type: "code" | "link" | "color" | "text"): string {
  const trimmed = content.trim();
  switch (type) {
    case "color":
      return "Color Hex";
    case "link":
      try {
        const url = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
        return `URL Link • ${url.hostname}`;
      } catch {
        return "URL Link";
      }
    case "code":
      if (trimmed.includes("fn ") || trimmed.includes("println!")) return "Rust Snippet";
      if (trimmed.includes("const ") || trimmed.includes("let ") || trimmed.includes("import ")) return "JS/TS Snippet";
      if (trimmed.includes("def ") || trimmed.includes("print(")) return "Python Snippet";
      if (trimmed.includes("<") && trimmed.includes(">")) return "HTML/JSX Snippet";
      return "Code Snippet";
    case "text":
    default:
      const lines = content.split("\n").length;
      if (lines > 1) {
        return `${lines} lines of text`;
      }
      const words = content.trim().split(/\s+/).length;
      return `${words} words (${content.length} chars)`;
  }
}

// Keycap UI Helper Component
const Keycap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        px: 0.6,
        py: 0.2,
        mx: 0.3,
        minWidth: 16,
        height: 16,
        borderRadius: "3px",
        fontSize: "0.65rem",
        fontWeight: 700,
        backgroundColor: prefersDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
        border: "1px solid",
        borderColor: prefersDarkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.1)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
        color: "text.primary",
        verticalAlign: "middle",
      }}
    >
      {children}
    </Box>
  );
};

export const ClipboardUI: React.FC = () => {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Real history items state (populated dynamically)
  const [historyItems, setHistoryItems] = useState<ClipboardItem[]>([]);

  // Ticker to force relative timestamps to refresh
  const [, setTimeTicker] = useState(0);

  // Create a ref list to handle auto-scrolling of selected elements into view
  const listItemsRef = useRef<(HTMLLIElement | null)[]>([]);

  // Memoized theme matching macOS system preferences
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
          primary: {
            main: prefersDarkMode ? "#0a84ff" : "#0071e3",
          },
          background: {
            default: "transparent",
            paper: prefersDarkMode ? "rgba(28, 28, 30, 0.85)" : "rgba(255, 255, 255, 0.95)",
          },
        },
        typography: {
          fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
      }),
    [prefersDarkMode],
  );

  // Poll the clipboard every 500ms
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await readText();
        if (text && text.trim()) {
          setHistoryItems((prev) => {
            // If the clipboard text is already the top item in history, do nothing
            if (prev.length > 0 && prev[0].content === text) {
              return prev;
            }

            // Otherwise, remove any duplicate instances elsewhere in the history,
            // create the new item, and add it to the top.
            const filtered = prev.filter((item) => item.content !== text);
            const type = detectItemType(text);
            const newItem: ClipboardItem = {
              id: Date.now().toString(),
              type,
              content: text,
              meta: getItemMeta(text, type),
              copiedAt: Date.now(),
            };

            // Keep at most 50 items
            return [newItem, ...filtered].slice(0, 50);
          });
        }
      } catch (err) {
        console.error("Failed to read clipboard:", err);
      }
    };

    // Immediate check on load
    checkClipboard();

    const interval = setInterval(checkClipboard, 500);
    return () => clearInterval(interval);
  }, []);

  // Update relative timestamps in UI every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker((prev) => prev + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    return historyItems.filter(
      (item) =>
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.meta.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [historyItems, searchQuery]);

  // Reset selected item index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Copy to clipboard and hide window
  const handleCopyAndHide = async (item: ClipboardItem) => {
    try {
      await writeText(item.content);
      setSnackbarMessage("Copied to clipboard!");
      setSnackbarOpen(true);

      // Hide the Tauri window after a short feedback animation delay
      setTimeout(async () => {
        try {
          const appWindow = getCurrentWindow();
          await appWindow.hide();
        } catch (winErr) {
          console.error("Failed to hide window:", winErr);
        }
      }, 250);
    } catch (err) {
      setSnackbarMessage("Failed to copy snippet.");
      setSnackbarOpen(true);
    }
  };

  // Keyboard navigation logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleCopyAndHide(filteredItems[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSearchQuery("");
      } else if (e.metaKey && !isNaN(Number(e.key))) {
        // Support ⌘1 through ⌘9 shortcuts
        const num = Number(e.key);
        if (num >= 1 && num <= filteredItems.length) {
          e.preventDefault();
          handleCopyAndHide(filteredItems[num - 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex]);

  // Auto-scroll selected item into view inside the list
  useEffect(() => {
    if (listItemsRef.current[selectedIndex]) {
      listItemsRef.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          p: 0,
          m: 0,
        }}
      >
        <Paper
          elevation={12}
          sx={{
            width: "100%",
            height: "100%",
            borderRadius: "16px",
            backgroundColor: prefersDarkMode ? "rgba(28, 28, 30, 0.88)" : "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(25px)",
            border: "1px solid",
            borderColor: prefersDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
            boxShadow: prefersDarkMode
              ? "0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.12) inset"
              : "0 24px 64px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.4) inset",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header Search Bar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid",
              borderColor: prefersDarkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
              backgroundColor: "transparent",
            }}
          >
            <TextField
              fullWidth
              variant="standard"
              placeholder="Search clipboard history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              slotProps={{
                input: {
                  disableUnderline: true,
                  startAdornment: (
                    <InputAdornment position="start" sx={{ pl: 2, pr: 1 }}>
                      <SearchIcon
                        sx={{
                          color: prefersDarkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)",
                          fontSize: 22,
                        }}
                      />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end" sx={{ pr: 2 }}>
                      <IconButton
                        size="small"
                        onClick={() => setSearchQuery("")}
                        sx={{
                          color: prefersDarkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)",
                          "&:hover": {
                            backgroundColor: prefersDarkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
                          },
                        }}
                      >
                        <ClearIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: {
                    fontSize: "1.05rem",
                    py: 2.2,
                    px: 1,
                    color: "text.primary",
                    fontWeight: 500,
                    "& input::placeholder": {
                      color: prefersDarkMode ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.4)",
                      opacity: 1,
                    },
                  },
                },
              }}
            />
          </Box>

          {/* List Area */}
          <List
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              p: 1,
              backgroundColor: "transparent",
              "&::-webkit-scrollbar": {
                width: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: prefersDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
                borderRadius: "4px",
                "&:hover": {
                  background: prefersDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
                },
              },
            }}
          >
            {filteredItems.length === 0 ? (
              <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
                <Typography variant="body1" sx={{ color: "text.secondary", fontWeight: 500, mb: 0.5 }}>
                  {searchQuery ? "No matches found" : "Clipboard history is empty"}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.disabled" }}>
                  {searchQuery ? "Try refining your search terms" : "Copy some text or links to populate history"}
                </Typography>
              </Box>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <ListItem
                    key={item.id}
                    disablePadding
                    ref={(el) => {
                      listItemsRef.current[index] = el;
                    }}
                    sx={{ mb: 0.5, borderRadius: "8px", overflow: "hidden" }}
                  >
                    <ListItemButton
                      onClick={() => handleCopyAndHide(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      sx={{
                        px: 2,
                        py: 1.2,
                        borderRadius: "8px",
                        backgroundColor: isSelected
                          ? prefersDarkMode
                            ? "rgba(10, 132, 255, 0.15)"
                            : "rgba(0, 113, 227, 0.08)"
                          : "transparent",
                        borderLeft: "3px solid",
                        borderLeftColor: isSelected
                          ? prefersDarkMode
                            ? "#0a84ff"
                            : "#0071e3"
                          : "transparent",
                        transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                        "&:hover": {
                          backgroundColor: isSelected
                            ? prefersDarkMode
                              ? "rgba(10, 132, 255, 0.2)"
                              : "rgba(0, 113, 227, 0.12)"
                            : prefersDarkMode
                              ? "rgba(255, 255, 255, 0.04)"
                              : "rgba(0, 0, 0, 0.03)",
                        },
                      }}
                    >
                      {/* Left Icon Display */}
                      <ListItemIcon sx={{ minWidth: 48 }}>
                        {item.type === "code" && (
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: prefersDarkMode ? "rgba(191, 90, 242, 0.15)" : "rgba(175, 82, 222, 0.1)",
                              color: prefersDarkMode ? "#bf5af2" : "#af52de",
                            }}
                          >
                            <CodeIcon sx={{ fontSize: 18 }} />
                          </Box>
                        )}
                        {item.type === "link" && (
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: prefersDarkMode ? "rgba(10, 132, 255, 0.15)" : "rgba(0, 113, 227, 0.1)",
                              color: prefersDarkMode ? "#0a84ff" : "#0071e3",
                            }}
                          >
                            <LinkIcon sx={{ fontSize: 18 }} />
                          </Box>
                        )}
                        {item.type === "text" && (
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: prefersDarkMode ? "rgba(255, 159, 10, 0.15)" : "rgba(255, 149, 0, 0.1)",
                              color: prefersDarkMode ? "#ff9f0a" : "#ff9500",
                            }}
                          >
                            <DescriptionIcon sx={{ fontSize: 18 }} />
                          </Box>
                        )}
                        {item.type === "color" && (
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: prefersDarkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                              border: "1px dashed",
                              borderColor: prefersDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.15)",
                            }}
                          >
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                backgroundColor: item.content,
                                border: "1px solid rgba(255,255,255,0.2)",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                              }}
                            />
                          </Box>
                        )}
                      </ListItemIcon>

                      {/* Content Preview text */}
                      <ListItemText
                        primary={
                          <Typography
                            noWrap
                            sx={{
                              fontSize: "0.925rem",
                              fontWeight: 500,
                              color: "text.primary",
                              fontFamily:
                                item.type === "code" || item.type === "color"
                                  ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                                  : "inherit",
                              mb: 0.2,
                            }}
                          >
                            {item.content}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ color: "text.secondary", fontWeight: 500 }}
                            >
                              {item.meta}
                            </Typography>
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ color: "text.disabled" }}
                            >
                              •
                            </Typography>
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ color: "text.disabled" }}
                            >
                              {getRelativeTime(item.copiedAt)}
                            </Typography>
                          </Box>
                        }
                      />

                      {/* Action Key Hint / Index */}
                      {index < 9 && (
                        <Box sx={{ ml: 2, display: "flex", alignItems: "center", gap: 0.5 }}>
                          {isSelected && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: prefersDarkMode ? "#0a84ff" : "#0071e3",
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                textTransform: "uppercase",
                                display: { xs: "none", sm: "inline" },
                              }}
                            >
                              Press Enter
                            </Typography>
                          )}
                          <Box
                            sx={{
                              px: 0.8,
                              py: 0.3,
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              fontFamily: "system-ui, -apple-system, sans-serif",
                              backgroundColor: isSelected
                                ? prefersDarkMode
                                  ? "rgba(10, 132, 255, 0.25)"
                                  : "rgba(0, 113, 227, 0.12)"
                                : prefersDarkMode
                                  ? "rgba(255, 255, 255, 0.05)"
                                  : "rgba(0, 0, 0, 0.04)",
                              color: isSelected
                                ? prefersDarkMode
                                  ? "#0a84ff"
                                  : "#0071e3"
                                : "text.secondary",
                              border: "1px solid",
                              borderColor: isSelected
                                ? prefersDarkMode
                                  ? "rgba(10, 132, 255, 0.3)"
                                  : "rgba(0, 113, 227, 0.2)"
                                : prefersDarkMode
                                  ? "rgba(255, 255, 255, 0.05)"
                                  : "rgba(0, 0, 0, 0.06)",
                              minWidth: 26,
                              textAlign: "center",
                              transition: "all 0.1s ease",
                            }}
                          >
                            ⌘{index + 1}
                          </Box>
                        </Box>
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })
            )}
          </List>

          {/* Footer Bar */}
          <Box
            sx={{
              py: 1.5,
              px: 2,
              backgroundColor: prefersDarkMode ? "rgba(20, 20, 22, 0.4)" : "rgba(0, 0, 0, 0.02)",
              borderTop: "1px solid",
              borderColor: prefersDarkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.75rem",
              color: "text.secondary",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
              <Keycap>↑</Keycap>
              <Keycap>↓</Keycap>
              <Typography variant="caption" sx={{ ml: 0.5 }}>to navigate</Typography>
              <Box component="span" sx={{ mx: 1, color: "text.disabled" }}>•</Box>
              <Keycap>↵</Keycap>
              <Typography variant="caption" sx={{ ml: 0.5 }}>to copy/paste</Typography>
              <Box component="span" sx={{ mx: 1, color: "text.disabled" }}>•</Box>
              <Keycap>⌘1-9</Keycap>
              <Typography variant="caption" sx={{ ml: 0.5 }}>quick select</Typography>
            </Box>

            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: "text.disabled",
                textTransform: "uppercase",
                fontSize: "0.65rem",
                display: { xs: "none", sm: "block" },
              }}
            >
              Clipboard Manager
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Copy feedback Toast */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          icon={<ContentCopyIcon fontSize="small" />}
          sx={{
            width: "100%",
            borderRadius: "10px",
            fontWeight: 500,
            backdropFilter: "blur(10px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
            backgroundColor: prefersDarkMode ? "rgba(46, 125, 50, 0.9)" : "rgba(237, 247, 237, 0.95)",
            color: prefersDarkMode ? "#fff" : "#1e4620",
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};
