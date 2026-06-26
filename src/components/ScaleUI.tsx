import React, { useState, useEffect } from "react";
import { Box, Typography, Button, Paper, Container } from "@mui/material";
import { useTouchScale } from "../hooks/useTouchScale";

export const ScaleUI: React.FC = () => {
  const { grams, kilograms, tare } = useTouchScale();
  const [prevGrams, setPrevGrams] = useState<number>(0);
  const [trend, setTrend] = useState<"up" | "down" | "stable">("stable");

  // Track if weight is increasing (up) or decreasing (down)
  useEffect(() => {
    if (grams > prevGrams) {
      setTrend("up");
    } else if (grams < prevGrams) {
      setTrend("down");
    } else if (grams === 0) {
      setTrend("stable");
    }
    setPrevGrams(grams);
  }, [grams, prevGrams]);

  // Determine dynamic visual styles based on current pressure trend
  let themeColor = "var(--text-main)";
  let accentLabelColor = "var(--text-muted)";
  let padShadowStyle = "var(--pad-shadow)";
  let trendSymbol = "";

  if (trend === "up") {
    themeColor = "#30d158"; // Apple green for increasing weight
    accentLabelColor = "rgba(48, 209, 88, 0.85)";
    padShadowStyle = "0 25px 60px rgba(48, 209, 88, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.05)";
    trendSymbol = "▲";
  } else if (trend === "down") {
    themeColor = "#ff453a"; // Apple red for decreasing weight
    accentLabelColor = "rgba(255, 69, 58, 0.85)";
    padShadowStyle = "0 25px 60px rgba(255, 69, 58, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.05)";
    trendSymbol = "▼";
  } else {
    themeColor = "var(--text-main)";
    accentLabelColor = "var(--text-muted)";
    padShadowStyle = "var(--pad-shadow)";
    trendSymbol = "";
  }

  return (
    <Container
      maxWidth="sm"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        py: 4,
        px: 2,
      }}
    >
      {/* Title */}
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-main)", mb: 0.5 }}
        >
          MacBook Touchpad Scale
        </Typography>
        <Typography variant="subtitle1" sx={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
          macOS Global Trackpad Force Scale (Native Backend)
        </Typography>
      </Box>

      {/* 300x300 Weighing Pad with embedded digital readouts */}
      <Paper
        elevation={0}
        sx={{
          width: 300,
          height: 300,
          borderRadius: "32px",
          background: "var(--pad-bg)",
          border: "1px solid",
          borderColor: trend === "stable" ? "var(--pad-border)" : themeColor,
          boxShadow: padShadowStyle,
          touchAction: "none",
          userSelect: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          p: 4,
          overflow: "hidden",
          position: "relative",
          transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Inner dashed ring decoration */}
        <Box
          sx={{
            position: "absolute",
            top: "16px",
            left: "16px",
            right: "16px",
            bottom: "16px",
            border: "2px dashed",
            borderColor: trend === "stable" ? "var(--card-border)" : "transparent",
            borderRadius: "24px",
            pointerEvents: "none",
            transition: "border-color 0.3s ease",
          }}
        />

        {/* Top Section of the Pad: Title / Trend */}
        <Box sx={{ textAlign: "center", zIndex: 3, mt: 1 }}>
          <Typography
            variant="overline"
            sx={{
              fontWeight: 800,
              letterSpacing: "0.15em",
              color: accentLabelColor,
              transition: "color 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            Weight {trendSymbol}
          </Typography>
        </Box>

        {/* Center Section of the Pad: Grams and Kilograms digits */}
        <Box sx={{ textAlign: "center", zIndex: 3 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center" }}>
            <Typography
              variant="h1"
              component="span"
              sx={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontWeight: 300,
                fontSize: "5.5rem",
                letterSpacing: "-0.05em",
                color: themeColor,
                transition: "color 0.2s ease",
              }}
            >
              {grams}
            </Typography>
            <Typography
              variant="h4"
              component="span"
              sx={{
                color: accentLabelColor,
                ml: 0.5,
                fontWeight: 500,
                transition: "color 0.2s ease",
              }}
            >
              g
            </Typography>
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontWeight: 500,
              color: accentLabelColor,
              mt: -0.5,
              transition: "color 0.2s ease",
            }}
          >
            {kilograms} kg
          </Typography>
        </Box>

        {/* Bottom Section of the Pad: Instruction Label */}
        <Box sx={{ textAlign: "center", zIndex: 3, mb: 1 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: accentLabelColor,
              textTransform: "uppercase",
              transition: "color 0.2s ease",
            }}
          >
            {trend === "up"
              ? "Weighing..."
              : trend === "down"
              ? "Releasing..."
              : "Weighing Pad"}
          </Typography>
        </Box>
      </Paper>

      {/* Control Actions (TARE Button below the pad) */}
      <Box sx={{ width: 300, mt: 4 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={tare}
          sx={{
            borderRadius: "14px",
            py: 1.6,
            fontSize: "1rem",
            textTransform: "uppercase",
            fontWeight: 800,
            letterSpacing: "0.05em",
            backgroundColor: "var(--accent-color)",
            color: "#ffffff",
            boxShadow: "none",
            "&:hover": {
              backgroundColor: "var(--accent-color-hover)",
              boxShadow: "none",
            },
            "&:active": {
              backgroundColor: "var(--accent-color-active)",
            },
          }}
        >
          Tare
        </Button>
      </Box>
    </Container>
  );
};
