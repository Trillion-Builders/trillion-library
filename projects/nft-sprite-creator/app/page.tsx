"use client";

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";

// Dynamically import PixiSandbox to avoid SSR issues
const PixiSandbox = lazy(() => import("./components/PixiSandbox"));

// Fal Logo SVG component
const FalLogo = ({ className = "", size = 32 }: { className?: string; size?: number }) => (
  <svg 
    viewBox="0 0 624 624" 
    fill="currentColor" 
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    className={className}
  >
    <path fillRule="evenodd" clipRule="evenodd" d="M402.365 0C413.17 0.000231771 421.824 8.79229 422.858 19.5596C432.087 115.528 508.461 191.904 604.442 201.124C615.198 202.161 624 210.821 624 221.638V402.362C624 413.179 615.198 421.839 604.442 422.876C508.461 432.096 432.087 508.472 422.858 604.44C421.824 615.208 413.17 624 402.365 624H221.635C210.83 624 202.176 615.208 201.142 604.44C191.913 508.472 115.538 432.096 19.5576 422.876C8.80183 421.839 0 413.179 0 402.362V221.638C0 210.821 8.80183 202.161 19.5576 201.124C115.538 191.904 191.913 115.528 201.142 19.5596C202.176 8.79215 210.83 0 221.635 0H402.365ZM312 124C208.17 124 124 208.17 124 312C124 415.83 208.17 500 312 500C415.83 500 500 415.83 500 312C500 208.17 415.83 124 312 124Z"/>
  </svg>
);

// Fal Spinner component
const FalSpinner = ({ size = 48 }: { size?: number }) => (
  <FalLogo className="fal-spinner" size={size} />
);

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Frame {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Bounding box of actual content (non-transparent pixels) within this frame
  contentBounds: BoundingBox;
}

// Get bounding box of non-transparent pixels in image data
function getContentBounds(ctx: CanvasRenderingContext2D, width: number, height: number): BoundingBox {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) { // Threshold for "visible" pixel
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // If no content found, return full frame
  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width, height };
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// Client-side background removal: convert white/near-white pixels to transparent
function removeWhiteBackground(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No canvas context")); return; }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert white/near-white pixels to transparent
      const threshold = 240; // pixels with R, G, B all above this become transparent
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0; // Set alpha to 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

// Download helper
function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

// Trim a frame canvas to its content bounds, optionally normalizing to a target size
function trimFrameToContent(
  sourceDataUrl: string,
  contentBounds: BoundingBox,
  targetWidth?: number,
  targetHeight?: number,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const { x, y, width: cw, height: ch } = contentBounds;
      // If content is the full frame or empty, just use the source
      if (cw <= 0 || ch <= 0) { resolve(sourceDataUrl); return; }

      const outW = targetWidth || cw;
      const outH = targetHeight || ch;
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;

      // Center the content in the output canvas
      const offsetX = Math.floor((outW - cw) / 2);
      const offsetY = Math.floor((outH - ch) / 2);
      ctx.drawImage(img, x, y, cw, ch, offsetX, offsetY, cw, ch);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = sourceDataUrl;
  });
}

// Auto-detect frame boundaries by scanning for content gaps (transparent columns/rows)
function autoDetectDividers(
  imageUrl: string,
  numCols: number,
  numRows: number,
): Promise<{ vertical: number[]; horizontal: number[] }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;

      // Scan for transparent columns (score each column by how "empty" it is)
      const colScores: number[] = [];
      for (let x = 0; x < img.width; x++) {
        let transparentPixels = 0;
        for (let y = 0; y < img.height; y++) {
          const alpha = data[(y * img.width + x) * 4 + 3];
          if (alpha < 20) transparentPixels++;
        }
        colScores.push(transparentPixels / img.height);
      }

      // Scan for transparent rows
      const rowScores: number[] = [];
      for (let y = 0; y < img.height; y++) {
        let transparentPixels = 0;
        for (let x = 0; x < img.width; x++) {
          const alpha = data[(y * img.width + x) * 4 + 3];
          if (alpha < 20) transparentPixels++;
        }
        rowScores.push(transparentPixels / img.width);
      }

      // Find the best vertical divider positions (numCols - 1 dividers)
      // Look for peaks of transparency near the expected uniform positions
      const findBestDividers = (scores: number[], count: number, totalSize: number): number[] => {
        if (count <= 0) return [];
        const positions: number[] = [];
        for (let i = 1; i <= count; i++) {
          const expected = (i / (count + 1)) * totalSize;
          const searchRadius = Math.floor(totalSize * 0.15); // Search ±15% around expected
          let bestPos = Math.round(expected);
          let bestScore = -1;

          for (let p = Math.max(1, Math.round(expected) - searchRadius); p < Math.min(totalSize - 1, Math.round(expected) + searchRadius); p++) {
            // Average score over a small window for stability
            const windowSize = Math.max(1, Math.floor(totalSize * 0.01));
            let avgScore = 0;
            for (let w = -windowSize; w <= windowSize; w++) {
              const idx = Math.max(0, Math.min(totalSize - 1, p + w));
              avgScore += scores[idx];
            }
            avgScore /= (windowSize * 2 + 1);
            if (avgScore > bestScore) {
              bestScore = avgScore;
              bestPos = p;
            }
          }
          positions.push((bestPos / totalSize) * 100);
        }
        return positions.sort((a, b) => a - b);
      };

      const vertical = findBestDividers(colScores, numCols - 1, img.width);
      const horizontal = findBestDividers(rowScores, numRows - 1, img.height);

      resolve({ vertical, horizontal });
    };
    img.src = imageUrl;
  });
}

export default function Home() {
  // Top-level tab
  const [activeTab, setActiveTab] = useState<"create" | "diy">("create");
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1: Character generation
  const [characterInputMode, setCharacterInputMode] = useState<"text" | "image" | "bear">("bear");
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [characterImageUrl, setCharacterImageUrl] = useState<string | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);

  // TrillionBears picker
  const [bearList, setBearList] = useState<string[]>([]);
  const [bearSearch, setBearSearch] = useState("");
  const [selectedBear, setSelectedBear] = useState<string | null>(null);

  useEffect(() => {
    fetch("/bears/manifest.json")
      .then((r) => r.json())
      .then((names: string[]) => setBearList(names))
      .catch(() => {});
  }, []);

  // Step 2: Sprite sheet generation (walk + jump + attack + idle)
  const [walkSpriteSheetUrl, setWalkSpriteSheetUrl] = useState<string | null>(null);
  const [jumpSpriteSheetUrl, setJumpSpriteSheetUrl] = useState<string | null>(null);
  const [attackSpriteSheetUrl, setAttackSpriteSheetUrl] = useState<string | null>(null);
  const [idleSpriteSheetUrl, setIdleSpriteSheetUrl] = useState<string | null>(null);
  const [isGeneratingSpriteSheet, setIsGeneratingSpriteSheet] = useState(false);

  // Step 3: Background removal (walk + jump + attack + idle)
  const [walkBgRemovedUrl, setWalkBgRemovedUrl] = useState<string | null>(null);
  const [jumpBgRemovedUrl, setJumpBgRemovedUrl] = useState<string | null>(null);
  const [attackBgRemovedUrl, setAttackBgRemovedUrl] = useState<string | null>(null);
  const [idleBgRemovedUrl, setIdleBgRemovedUrl] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // Step 4: Frame extraction (grid-based) - walk
  const [walkGridCols, setWalkGridCols] = useState(2);
  const [walkGridRows, setWalkGridRows] = useState(2);
  const [walkVerticalDividers, setWalkVerticalDividers] = useState<number[]>([]);
  const [walkHorizontalDividers, setWalkHorizontalDividers] = useState<number[]>([]);
  const [walkExtractedFrames, setWalkExtractedFrames] = useState<Frame[]>([]);
  const [walkSpriteSheetDimensions, setWalkSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const walkSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - jump
  const [jumpGridCols, setJumpGridCols] = useState(2);
  const [jumpGridRows, setJumpGridRows] = useState(2);
  const [jumpVerticalDividers, setJumpVerticalDividers] = useState<number[]>([]);
  const [jumpHorizontalDividers, setJumpHorizontalDividers] = useState<number[]>([]);
  const [jumpExtractedFrames, setJumpExtractedFrames] = useState<Frame[]>([]);
  const [jumpSpriteSheetDimensions, setJumpSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const jumpSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - attack
  const [attackGridCols, setAttackGridCols] = useState(2);
  const [attackGridRows, setAttackGridRows] = useState(2);
  const [attackVerticalDividers, setAttackVerticalDividers] = useState<number[]>([]);
  const [attackHorizontalDividers, setAttackHorizontalDividers] = useState<number[]>([]);
  const [attackExtractedFrames, setAttackExtractedFrames] = useState<Frame[]>([]);
  const [attackSpriteSheetDimensions, setAttackSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const attackSpriteSheetRef = useRef<HTMLImageElement>(null);

  // Step 4: Frame extraction (grid-based) - idle
  const [idleGridCols, setIdleGridCols] = useState(2);
  const [idleGridRows, setIdleGridRows] = useState(2);
  const [idleVerticalDividers, setIdleVerticalDividers] = useState<number[]>([]);
  const [idleHorizontalDividers, setIdleHorizontalDividers] = useState<number[]>([]);
  const [idleExtractedFrames, setIdleExtractedFrames] = useState<Frame[]>([]);
  const [idleSpriteSheetDimensions, setIdleSpriteSheetDimensions] = useState({ width: 0, height: 0 });
  const idleSpriteSheetRef = useRef<HTMLImageElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  
  // Which sprite sheet is being edited
  const [activeSheet, setActiveSheet] = useState<"walk" | "jump" | "attack" | "idle">("walk");

  // Step 5: Animation preview
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [direction, setDirection] = useState<"right" | "left">("right");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Step 6: Sandbox
  const [backgroundMode, setBackgroundMode] = useState<"default" | "custom">("default");
  const [customBackgroundLayers, setCustomBackgroundLayers] = useState<{
    layer1Url: string | null;
    layer2Url: string | null;
    layer3Url: string | null;
  }>({ layer1Url: null, layer2Url: null, layer3Url: null });
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);

  // Frame trimming
  const [trimToContent, setTrimToContent] = useState(true);
  const [normalizeSize, setNormalizeSize] = useState(true);

  // Error handling
  const [error, setError] = useState<string | null>(null);

  // Initialize walk divider positions when grid changes
  useEffect(() => {
    if (walkSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < walkGridCols; i++) {
        vPositions.push((i / walkGridCols) * 100);
      }
      setWalkVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < walkGridRows; i++) {
        hPositions.push((i / walkGridRows) * 100);
      }
      setWalkHorizontalDividers(hPositions);
    }
  }, [walkGridCols, walkGridRows, walkSpriteSheetDimensions.width]);

  // Initialize jump divider positions when grid changes
  useEffect(() => {
    if (jumpSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < jumpGridCols; i++) {
        vPositions.push((i / jumpGridCols) * 100);
      }
      setJumpVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < jumpGridRows; i++) {
        hPositions.push((i / jumpGridRows) * 100);
      }
      setJumpHorizontalDividers(hPositions);
    }
  }, [jumpGridCols, jumpGridRows, jumpSpriteSheetDimensions.width]);

  // Initialize attack divider positions when grid changes
  useEffect(() => {
    if (attackSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < attackGridCols; i++) {
        vPositions.push((i / attackGridCols) * 100);
      }
      setAttackVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < attackGridRows; i++) {
        hPositions.push((i / attackGridRows) * 100);
      }
      setAttackHorizontalDividers(hPositions);
    }
  }, [attackGridCols, attackGridRows, attackSpriteSheetDimensions.width]);

  // Initialize idle divider positions when grid changes
  useEffect(() => {
    if (idleSpriteSheetDimensions.width > 0) {
      const vPositions: number[] = [];
      for (let i = 1; i < idleGridCols; i++) {
        vPositions.push((i / idleGridCols) * 100);
      }
      setIdleVerticalDividers(vPositions);

      const hPositions: number[] = [];
      for (let i = 1; i < idleGridRows; i++) {
        hPositions.push((i / idleGridRows) * 100);
      }
      setIdleHorizontalDividers(hPositions);
    }
  }, [idleGridCols, idleGridRows, idleSpriteSheetDimensions.width]);

  // Extract walk frames when divider positions change
  useEffect(() => {
    if (walkBgRemovedUrl && walkSpriteSheetDimensions.width > 0) {
      extractWalkFrames();
    }
  }, [walkBgRemovedUrl, walkVerticalDividers, walkHorizontalDividers, walkSpriteSheetDimensions]);

  // Extract jump frames when divider positions change
  useEffect(() => {
    if (jumpBgRemovedUrl && jumpSpriteSheetDimensions.width > 0) {
      extractJumpFrames();
    }
  }, [jumpBgRemovedUrl, jumpVerticalDividers, jumpHorizontalDividers, jumpSpriteSheetDimensions]);

  // Extract attack frames when divider positions change
  useEffect(() => {
    if (attackBgRemovedUrl && attackSpriteSheetDimensions.width > 0) {
      extractAttackFrames();
    }
  }, [attackBgRemovedUrl, attackVerticalDividers, attackHorizontalDividers, attackSpriteSheetDimensions]);

  // Extract idle frames when divider positions change
  useEffect(() => {
    if (idleBgRemovedUrl && idleSpriteSheetDimensions.width > 0) {
      extractIdleFrames();
    }
  }, [idleBgRemovedUrl, idleVerticalDividers, idleHorizontalDividers, idleSpriteSheetDimensions]);

  // Animation loop (uses walk frames for preview)
  useEffect(() => {
    if (!isPlaying || walkExtractedFrames.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % walkExtractedFrames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, fps, walkExtractedFrames.length]);

  // Draw current frame on canvas (uses walk frames for preview)
  useEffect(() => {
    if (walkExtractedFrames.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = walkExtractedFrames[currentFrameIndex];
    if (!frame) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (direction === "left") {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(img, -canvas.width, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = frame.dataUrl;
  }, [currentFrameIndex, walkExtractedFrames, direction]);

  // Keyboard controls for Step 5
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentStep !== 5) return;

      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        setDirection("right");
        if (!isPlaying) setIsPlaying(true);
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        setDirection("left");
        if (!isPlaying) setIsPlaying(true);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (currentStep !== 5) return;

      if (
        e.key === "d" ||
        e.key === "D" ||
        e.key === "ArrowRight" ||
        e.key === "a" ||
        e.key === "A" ||
        e.key === "ArrowLeft"
      ) {
        setIsPlaying(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [currentStep, isPlaying]);

  // Sandbox keyboard controls and game loop are now handled inside PixiSandbox component

  // API calls
  const generateCharacter = async () => {
    // Validate based on input mode
    if (characterInputMode === "text" && !characterPrompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    if (characterInputMode === "image" && !inputImageUrl.trim()) {
      setError("Please enter an image URL");
      return;
    }
    if (characterInputMode === "bear" && !selectedBear) {
      setError("Please select a TrillionBear");
      return;
    }

    setError(null);
    setIsGeneratingCharacter(true);

    try {
      // For bear mode, convert the WebP thumbnail to a data URL first (server can't resolve relative paths)
      let imageSource: string | undefined;
      if (characterInputMode === "bear" && selectedBear) {
        const bearResp = await fetch(`/bears/${selectedBear}.webp`);
        const bearBlob = await bearResp.blob();
        imageSource = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(bearBlob);
        });
      } else if (characterInputMode === "image") {
        imageSource = inputImageUrl;
      }

      const requestBody = imageSource
        ? { imageUrl: imageSource, prompt: characterPrompt || undefined }
        : { prompt: characterPrompt };

      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate character");
      }

      setCharacterImageUrl(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate character");
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const generateSpriteSheet = async () => {
    if (!characterImageUrl) return;

    setError(null);
    setIsGeneratingSpriteSheet(true);

    try {
      // Send parallel requests for walk, jump, attack, and idle sprite sheets
      const [walkResponse, jumpResponse, attackResponse, idleResponse] = await Promise.all([
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterImageUrl, type: "walk" }),
        }),
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterImageUrl, type: "jump" }),
        }),
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterImageUrl, type: "attack" }),
        }),
        fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterImageUrl, type: "idle" }),
        }),
      ]);

      const walkData = await walkResponse.json();
      const jumpData = await jumpResponse.json();
      const attackData = await attackResponse.json();
      const idleData = await idleResponse.json();

      if (!walkResponse.ok) {
        throw new Error(walkData.error || "Failed to generate walk sprite sheet");
      }
      if (!jumpResponse.ok) {
        throw new Error(jumpData.error || "Failed to generate jump sprite sheet");
      }
      if (!attackResponse.ok) {
        throw new Error(attackData.error || "Failed to generate attack sprite sheet");
      }
      if (!idleResponse.ok) {
        throw new Error(idleData.error || "Failed to generate idle sprite sheet");
      }

      setWalkSpriteSheetUrl(walkData.imageUrl);
      setJumpSpriteSheetUrl(jumpData.imageUrl);
      setAttackSpriteSheetUrl(attackData.imageUrl);
      setIdleSpriteSheetUrl(idleData.imageUrl);
      setCompletedSteps((prev) => new Set([...prev, 1]));
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate sprite sheets");
    } finally {
      setIsGeneratingSpriteSheet(false);
    }
  };

  const [regeneratingSpriteSheet, setRegeneratingSpriteSheet] = useState<"walk" | "jump" | "attack" | "idle" | null>(null);

  const regenerateSpriteSheet = async (type: "walk" | "jump" | "attack" | "idle") => {
    if (!characterImageUrl) return;

    setError(null);
    setRegeneratingSpriteSheet(type);

    try {
      const response = await fetch("/api/generate-sprite-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterImageUrl, type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to generate ${type} sprite sheet`);
      }

      if (type === "walk") {
        setWalkSpriteSheetUrl(data.imageUrl);
      } else if (type === "jump") {
        setJumpSpriteSheetUrl(data.imageUrl);
      } else if (type === "attack") {
        setAttackSpriteSheetUrl(data.imageUrl);
      } else if (type === "idle") {
        setIdleSpriteSheetUrl(data.imageUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to regenerate ${type} sprite sheet`);
    } finally {
      setRegeneratingSpriteSheet(null);
    }
  };

  const removeBackground = async () => {
    if (!walkSpriteSheetUrl || !jumpSpriteSheetUrl || !attackSpriteSheetUrl || !idleSpriteSheetUrl) return;

    setError(null);
    setIsRemovingBg(true);

    try {
      // Process all sprite sheets client-side (white → transparent)
      const [walkResult, jumpResult, attackResult, idleResult] = await Promise.all([
        removeWhiteBackground(walkSpriteSheetUrl),
        removeWhiteBackground(jumpSpriteSheetUrl),
        removeWhiteBackground(attackSpriteSheetUrl),
        removeWhiteBackground(idleSpriteSheetUrl),
      ]);

      setWalkBgRemovedUrl(walkResult);
      setJumpBgRemovedUrl(jumpResult);
      setAttackBgRemovedUrl(attackResult);
      setIdleBgRemovedUrl(idleResult);
      setWalkSpriteSheetDimensions({ width: 1024, height: 1024 });
      setJumpSpriteSheetDimensions({ width: 1024, height: 1024 });
      setAttackSpriteSheetDimensions({ width: 1024, height: 1024 });
      setIdleSpriteSheetDimensions({ width: 1024, height: 1024 });
      setCompletedSteps((prev) => new Set([...prev, 2]));
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove background");
    } finally {
      setIsRemovingBg(false);
    }
  };

  const generateBackground = async () => {
    if (!characterImageUrl) return;

    setError(null);
    setIsGeneratingBackground(true);

    try {
      const response = await fetch("/api/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          characterPrompt: characterPrompt || "pixel art game character",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate background");
      }

      setCustomBackgroundLayers({
        layer1Url: data.layer1Url,
        layer2Url: data.layer2Url,
        layer3Url: data.layer3Url,
      });
      setBackgroundMode("custom");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate background");
    } finally {
      setIsGeneratingBackground(false);
    }
  };

  const [regeneratingLayer, setRegeneratingLayer] = useState<number | null>(null);

  const regenerateBackgroundLayer = async (layerNumber: 1 | 2 | 3) => {
    if (!characterImageUrl || !characterPrompt || !customBackgroundLayers.layer1Url) return;

    setError(null);
    setRegeneratingLayer(layerNumber);

    try {
      const response = await fetch("/api/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          characterPrompt,
          regenerateLayer: layerNumber,
          existingLayers: customBackgroundLayers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate layer");
      }

      setCustomBackgroundLayers({
        layer1Url: data.layer1Url,
        layer2Url: data.layer2Url,
        layer3Url: data.layer3Url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate layer");
    } finally {
      setRegeneratingLayer(null);
    }
  };

  // Generic frame extraction with trim-to-content support
  const extractFramesGeneric = useCallback(async (
    imageUrl: string,
    verticalDividers: number[],
    horizontalDividers: number[],
    setFrames: (frames: Frame[]) => void,
  ) => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      const rawFrames: Frame[] = [];
      const colPositions = [0, ...verticalDividers, 100];
      const rowPositions = [0, ...horizontalDividers, 100];

      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        const frameHeight = endY - startY;

        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const frameWidth = endX - startX;

          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(img, startX, startY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
            rawFrames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: startX,
              y: startY,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }
      }

      if (trimToContent && rawFrames.length > 0) {
        // Find the largest content dimensions for normalization
        let maxW = 0, maxH = 0;
        for (const f of rawFrames) {
          maxW = Math.max(maxW, f.contentBounds.width);
          maxH = Math.max(maxH, f.contentBounds.height);
        }
        // Add small padding (4px each side)
        const targetW = normalizeSize ? maxW + 8 : undefined;
        const targetH = normalizeSize ? maxH + 8 : undefined;

        const trimmedFrames = await Promise.all(
          rawFrames.map(async (f) => {
            const trimmedUrl = await trimFrameToContent(f.dataUrl, f.contentBounds, targetW, targetH);
            return { ...f, dataUrl: trimmedUrl };
          })
        );
        setFrames(trimmedFrames);
      } else {
        setFrames(rawFrames);
      }
    };

    img.src = imageUrl;
  }, [trimToContent, normalizeSize]);

  const extractWalkFrames = useCallback(() => {
    extractFramesGeneric(walkBgRemovedUrl!, walkVerticalDividers, walkHorizontalDividers, setWalkExtractedFrames);
  }, [walkBgRemovedUrl, walkVerticalDividers, walkHorizontalDividers, extractFramesGeneric]);

  const extractJumpFrames = useCallback(() => {
    extractFramesGeneric(jumpBgRemovedUrl!, jumpVerticalDividers, jumpHorizontalDividers, setJumpExtractedFrames);
  }, [jumpBgRemovedUrl, jumpVerticalDividers, jumpHorizontalDividers, extractFramesGeneric]);

  const extractAttackFrames = useCallback(() => {
    extractFramesGeneric(attackBgRemovedUrl!, attackVerticalDividers, attackHorizontalDividers, setAttackExtractedFrames);
  }, [attackBgRemovedUrl, attackVerticalDividers, attackHorizontalDividers, extractFramesGeneric]);

  const extractIdleFrames = useCallback(() => {
    extractFramesGeneric(idleBgRemovedUrl!, idleVerticalDividers, idleHorizontalDividers, setIdleExtractedFrames);
  }, [idleBgRemovedUrl, idleVerticalDividers, idleHorizontalDividers, extractFramesGeneric]);

  // Walk vertical divider drag handling
  const handleWalkVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = walkSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...walkVerticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setWalkVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Walk horizontal divider drag handling
  const handleWalkHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = walkSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...walkHorizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setWalkHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Jump vertical divider drag handling
  const handleJumpVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = jumpSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...jumpVerticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setJumpVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Jump horizontal divider drag handling
  const handleJumpHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = jumpSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...jumpHorizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setJumpHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Attack vertical divider drag handling
  const handleAttackVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = attackSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...attackVerticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setAttackVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Attack horizontal divider drag handling
  const handleAttackHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = attackSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...attackHorizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setAttackHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Idle vertical divider drag handling
  const handleIdleVerticalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = idleSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - imgRect.left;
      const percentage = Math.max(0, Math.min(100, (relativeX / imgRect.width) * 100));

      const newPositions = [...idleVerticalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setIdleVerticalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Idle horizontal divider drag handling
  const handleIdleHorizontalDividerDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const imgRect = idleSpriteSheetRef.current?.getBoundingClientRect();
    if (!imgRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const relativeY = moveEvent.clientY - imgRect.top;
      const percentage = Math.max(0, Math.min(100, (relativeY / imgRect.height) * 100));

      const newPositions = [...idleHorizontalDividers];
      const minPos = index > 0 ? newPositions[index - 1] + 2 : 2;
      const maxPos = index < newPositions.length - 1 ? newPositions[index + 1] - 2 : 98;
      newPositions[index] = Math.max(minPos, Math.min(maxPos, percentage));
      setIdleHorizontalDividers(newPositions);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Auto-detect dividers for the active sheet
  const handleAutoDetect = async () => {
    const sheetMap = {
      walk: { url: walkBgRemovedUrl, cols: walkGridCols, rows: walkGridRows, setV: setWalkVerticalDividers, setH: setWalkHorizontalDividers },
      jump: { url: jumpBgRemovedUrl, cols: jumpGridCols, rows: jumpGridRows, setV: setJumpVerticalDividers, setH: setJumpHorizontalDividers },
      attack: { url: attackBgRemovedUrl, cols: attackGridCols, rows: attackGridRows, setV: setAttackVerticalDividers, setH: setAttackHorizontalDividers },
      idle: { url: idleBgRemovedUrl, cols: idleGridCols, rows: idleGridRows, setV: setIdleVerticalDividers, setH: setIdleHorizontalDividers },
    };
    const s = sheetMap[activeSheet];
    if (!s.url) return;
    const result = await autoDetectDividers(s.url, s.cols, s.rows);
    s.setV(result.vertical);
    s.setH(result.horizontal);
  };

  // Re-extract all frames when trim/normalize toggles change
  useEffect(() => {
    if (walkBgRemovedUrl && walkSpriteSheetDimensions.width > 0) extractWalkFrames();
    if (jumpBgRemovedUrl && jumpSpriteSheetDimensions.width > 0) extractJumpFrames();
    if (attackBgRemovedUrl && attackSpriteSheetDimensions.width > 0) extractAttackFrames();
    if (idleBgRemovedUrl && idleSpriteSheetDimensions.width > 0) extractIdleFrames();
  }, [trimToContent, normalizeSize]);

  // Export functions
  const exportWalkSpriteSheet = () => walkBgRemovedUrl && downloadDataUrl(walkBgRemovedUrl, "walk-sprite-sheet.png");
  const exportJumpSpriteSheet = () => jumpBgRemovedUrl && downloadDataUrl(jumpBgRemovedUrl, "jump-sprite-sheet.png");
  const exportAttackSpriteSheet = () => attackBgRemovedUrl && downloadDataUrl(attackBgRemovedUrl, "attack-sprite-sheet.png");
  const exportIdleSpriteSheet = () => idleBgRemovedUrl && downloadDataUrl(idleBgRemovedUrl, "idle-sprite-sheet.png");

  const exportAllFrames = () => {
    const allFrames = [
      ...walkExtractedFrames.map((f, i) => ({ url: f.dataUrl, name: `walk-frame-${i + 1}.png` })),
      ...jumpExtractedFrames.map((f, i) => ({ url: f.dataUrl, name: `jump-frame-${i + 1}.png` })),
      ...attackExtractedFrames.map((f, i) => ({ url: f.dataUrl, name: `attack-frame-${i + 1}.png` })),
      ...idleExtractedFrames.map((f, i) => ({ url: f.dataUrl, name: `idle-frame-${i + 1}.png` })),
    ];
    allFrames.forEach(({ url, name }) => downloadDataUrl(url, name));
  };

  const exportFramesForType = (type: "walk" | "jump" | "attack" | "idle") => {
    const framesMap = { walk: walkExtractedFrames, jump: jumpExtractedFrames, attack: attackExtractedFrames, idle: idleExtractedFrames };
    framesMap[type].forEach((f, i) => downloadDataUrl(f.dataUrl, `${type}-frame-${i + 1}.png`));
  };

  const proceedToFrameExtraction = () => {
    setCompletedSteps((prev) => new Set([...prev, 3]));
    setCurrentStep(4);
  };

  const proceedToSandbox = () => {
    setCompletedSteps((prev) => new Set([...prev, 4, 5]));
    setCurrentStep(6);
  };

  return (
    <main className="container">
      <header className="header">
        <div className="header-logo">
          <FalLogo size={36} />
          <h1>NFT Sprite Creator</h1>
        </div>
        <p>Character to sprite sheet. Automated.</p>

        {/* Top-level tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "center" }}>
          <button
            className={`btn ${activeTab === "create" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("create")}
            style={{ fontSize: "0.9rem" }}
          >
            Create Sprites
          </button>
          <button
            className={`btn ${activeTab === "diy" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("diy")}
            style={{ fontSize: "0.9rem" }}
          >
            DIY Guide
          </button>
        </div>
      </header>

      {/* ========== DIY GUIDE TAB ========== */}
      {activeTab === "diy" && (
        <div className="step-container" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2 className="step-title" style={{ marginBottom: "1.5rem" }}>
            How This Works
          </h2>

          <div style={{ marginBottom: "2rem", lineHeight: 1.7, color: "var(--text-secondary)" }}>
            <p style={{ marginBottom: "1rem" }}>
              This tool takes a character image (or text description), generates pixel art sprite sheets
              for walk, jump, attack, and idle animations, removes the background, extracts individual frames,
              and lets you preview the animation in a sandbox.
            </p>
            <p style={{ marginBottom: "1rem", color: "var(--text-primary)", fontWeight: 600, fontSize: "1.05rem" }}>
              Honestly, most of this is just prompting. If you&apos;d rather do it yourself with your
              preferred tools, here are the exact stages and prompts we use.
            </p>
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
              Works with any AI image generator that supports image-to-image: Gemini, ChatGPT, Midjourney, etc.
            </p>
          </div>

          {/* Stage 1: Character */}
          <div style={{ marginBottom: "2rem", padding: "1.25rem", border: "1px solid var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span style={{ background: "var(--accent-color)", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>1</span>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Character to Pixel Art</h3>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
              Upload your NFT or character image and convert it to pixel art style. If starting from text, describe your character.
            </p>
            <div style={{ position: "relative" }}>
              <pre style={{ background: "var(--bg-primary)", padding: "1rem", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6, border: "1px solid var(--border-color)", margin: 0 }}>{`Transform this character into detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).
IMPORTANT: Must be a FULL BODY shot showing the entire character from head to feet.
Keep the character centered in the frame on a plain white background.
Include proper shading, highlights, and anti-aliased edges for a polished look.
The character should have well-defined features, expressive details, and rich colors.
Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite sheet animation.
Maintain the character's key features, colors, and identity while converting to pixel art.`}</pre>
              <button
                onClick={() => copyToClipboard(`Transform this character into detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).\nIMPORTANT: Must be a FULL BODY shot showing the entire character from head to feet.\nKeep the character centered in the frame on a plain white background.\nInclude proper shading, highlights, and anti-aliased edges for a polished look.\nThe character should have well-defined features, expressive details, and rich colors.\nShow in a front-facing or 3/4 view pose, standing idle, suitable for sprite sheet animation.\nMaintain the character's key features, colors, and identity while converting to pixel art.`, "stage1")}
                style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-secondary)" }}
              >
                {copiedPrompt === "stage1" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              Tip: Attach your character image when sending this prompt. Works great with Gemini, ChatGPT, or any image-to-image model.
            </p>
          </div>

          {/* Stage 2: Walk Cycle */}
          <div style={{ marginBottom: "2rem", padding: "1.25rem", border: "1px solid var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span style={{ background: "var(--accent-color)", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>2</span>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Sprite Sheets (Walk / Jump / Attack / Idle)</h3>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
              Send the pixel art character from Stage 1 with each of these prompts to generate 4-frame animation sheets.
              Each generates a 2x2 grid on a white background.
            </p>

            {/* Walk prompt */}
            <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", marginTop: "1rem" }}>Walk Cycle:</p>
            <div style={{ position: "relative" }}>
              <pre style={{ background: "var(--bg-primary)", padding: "1rem", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6, border: "1px solid var(--border-color)", margin: 0 }}>{`Create a 4-frame pixel art walk cycle sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is walking to the right.

Top row (frames 1-2):
Frame 1 (top-left): Right leg forward, left leg back - stride position
Frame 2 (top-right): Legs close together, passing/crossing - transition

Bottom row (frames 3-4):
Frame 3 (bottom-left): Left leg forward, right leg back - opposite stride
Frame 4 (bottom-right): Legs close together, passing/crossing - transition back

Each frame shows a different phase of the walking motion. This creates a smooth looping walk cycle.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`}</pre>
              <button
                onClick={() => copyToClipboard(`Create a 4-frame pixel art walk cycle sprite sheet of this character.\n\nArrange the 4 frames in a 2x2 grid on white background. The character is walking to the right.\n\nTop row (frames 1-2):\nFrame 1 (top-left): Right leg forward, left leg back - stride position\nFrame 2 (top-right): Legs close together, passing/crossing - transition\n\nBottom row (frames 3-4):\nFrame 3 (bottom-left): Left leg forward, right leg back - opposite stride\nFrame 4 (bottom-right): Legs close together, passing/crossing - transition back\n\nEach frame shows a different phase of the walking motion. This creates a smooth looping walk cycle.\n\nUse detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`, "walk")}
                style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-secondary)" }}
              >
                {copiedPrompt === "walk" ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Jump prompt */}
            <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", marginTop: "1rem" }}>Jump:</p>
            <div style={{ position: "relative" }}>
              <pre style={{ background: "var(--bg-primary)", padding: "1rem", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6, border: "1px solid var(--border-color)", margin: 0 }}>{`Create a 4-frame pixel art jump animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is jumping.

Top row (frames 1-2):
Frame 1 (top-left): Crouch/anticipation - slightly crouched, knees bent, preparing to jump
Frame 2 (top-right): Rising - in air, legs tucked up, arms up, ascending

Bottom row (frames 3-4):
Frame 3 (bottom-left): Apex/peak - highest point of jump, body stretched or tucked
Frame 4 (bottom-right): Landing - landing, slight crouch to absorb impact

Use detailed 32-bit pixel art style. Same character design in all frames. Character facing right.`}</pre>
              <button
                onClick={() => copyToClipboard(`Create a 4-frame pixel art jump animation sprite sheet of this character.\n\nArrange the 4 frames in a 2x2 grid on white background. The character is jumping.\n\nTop row (frames 1-2):\nFrame 1 (top-left): Crouch/anticipation - slightly crouched, knees bent, preparing to jump\nFrame 2 (top-right): Rising - in air, legs tucked up, arms up, ascending\n\nBottom row (frames 3-4):\nFrame 3 (bottom-left): Apex/peak - highest point of jump, body stretched or tucked\nFrame 4 (bottom-right): Landing - landing, slight crouch to absorb impact\n\nUse detailed 32-bit pixel art style. Same character design in all frames. Character facing right.`, "jump")}
                style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-secondary)" }}
              >
                {copiedPrompt === "jump" ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Attack prompt */}
            <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", marginTop: "1rem" }}>Attack:</p>
            <div style={{ position: "relative" }}>
              <pre style={{ background: "var(--bg-primary)", padding: "1rem", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6, border: "1px solid var(--border-color)", margin: 0 }}>{`Create a 4-frame pixel art attack animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The attack should fit the character's design - sword slash, magic spell, punch, kick, or energy blast.

Top row (frames 1-2):
Frame 1 (top-left): Wind-up/anticipation - preparing to attack
Frame 2 (top-right): Attack in motion - strike or spell being unleashed

Bottom row (frames 3-4):
Frame 3 (bottom-left): Impact/peak - maximum extension of attack
Frame 4 (bottom-right): Recovery - returning to ready stance

Use detailed 32-bit pixel art style. Same character design in all frames. Character facing right. Make the attack visually dynamic.`}</pre>
              <button
                onClick={() => copyToClipboard(`Create a 4-frame pixel art attack animation sprite sheet of this character.\n\nArrange the 4 frames in a 2x2 grid on white background. The attack should fit the character's design - sword slash, magic spell, punch, kick, or energy blast.\n\nTop row (frames 1-2):\nFrame 1 (top-left): Wind-up/anticipation - preparing to attack\nFrame 2 (top-right): Attack in motion - strike or spell being unleashed\n\nBottom row (frames 3-4):\nFrame 3 (bottom-left): Impact/peak - maximum extension of attack\nFrame 4 (bottom-right): Recovery - returning to ready stance\n\nUse detailed 32-bit pixel art style. Same character design in all frames. Character facing right. Make the attack visually dynamic.`, "attack")}
                style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-secondary)" }}
              >
                {copiedPrompt === "attack" ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Idle prompt */}
            <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", marginTop: "1rem" }}>Idle:</p>
            <div style={{ position: "relative" }}>
              <pre style={{ background: "var(--bg-primary)", padding: "1rem", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6, border: "1px solid var(--border-color)", margin: 0 }}>{`Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. Subtle idle animation.

Top row (frames 1-2):
Frame 1 (top-left): Neutral standing pose - relaxed stance
Frame 2 (top-right): Slight inhale - chest/body rises subtly

Bottom row (frames 3-4):
Frame 3 (bottom-left): Full breath - slight upward posture
Frame 4 (bottom-right): Exhale - returning to neutral, slight settle

Keep movements SUBTLE - gentle breathing/idle loop, not dramatic motion. Character should look alive but relaxed.

Use detailed 32-bit pixel art style. Same character design in all frames. Character facing right.`}</pre>
              <button
                onClick={() => copyToClipboard(`Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.\n\nArrange the 4 frames in a 2x2 grid on white background. Subtle idle animation.\n\nTop row (frames 1-2):\nFrame 1 (top-left): Neutral standing pose - relaxed stance\nFrame 2 (top-right): Slight inhale - chest/body rises subtly\n\nBottom row (frames 3-4):\nFrame 3 (bottom-left): Full breath - slight upward posture\nFrame 4 (bottom-right): Exhale - returning to neutral, slight settle\n\nKeep movements SUBTLE - gentle breathing/idle loop, not dramatic motion. Character should look alive but relaxed.\n\nUse detailed 32-bit pixel art style. Same character design in all frames. Character facing right.`, "idle")}
                style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-secondary)" }}
              >
                {copiedPrompt === "idle" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Stage 3: Post-processing */}
          <div style={{ marginBottom: "2rem", padding: "1.25rem", border: "1px solid var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span style={{ background: "var(--accent-color)", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>3</span>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Background Removal + Frame Extraction</h3>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
              No prompting needed here. This is image processing:
            </p>
            <ul style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.8, paddingLeft: "1.25rem" }}>
              <li><strong>Remove the white background</strong> — Any tool works: remove.bg, Photoshop, GIMP, or even canvas pixel scanning (set white pixels to transparent).</li>
              <li><strong>Split the 2x2 grid into 4 frames</strong> — Cut the image in half horizontally and vertically. If the AI didn&apos;t generate a perfect grid, trim each frame to its content bounds.</li>
              <li><strong>Normalize frame sizes</strong> — Pad all frames to the same dimensions (use the largest frame as the target), centering the character in each.</li>
            </ul>
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: "0.75rem" }}>
              Tip: The &quot;Create Sprites&quot; tab does all of this automatically if you don&apos;t want to bother.
            </p>
          </div>

          {/* Stage 4: Optional parallax background */}
          <div style={{ marginBottom: "2rem", padding: "1.25rem", border: "1px solid var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span style={{ background: "var(--text-tertiary)", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>4</span>
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Parallax Background <span style={{ color: "var(--text-tertiary)", fontWeight: 400, fontSize: "0.85rem" }}>(optional)</span></h3>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
              Generate a 3-layer parallax background that matches your character&apos;s world. Each layer is generated sequentially — feed the previous layers as context.
            </p>
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
              Layer 1: Sky/backdrop. Layer 2: Midground (character&apos;s iconic location). Layer 3: Foreground (ground, platforms).
              Layers 2 &amp; 3 should use transparent backgrounds so they overlay properly.
            </p>
          </div>

          {/* Tools that work */}
          <div style={{ marginBottom: "2rem", padding: "1.25rem", border: "1px solid var(--border-color)", borderRadius: "12px", background: "var(--bg-secondary)" }}>
            <h3 style={{ margin: "0 0 0.75rem 0", color: "var(--text-primary)" }}>Tools That Work</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div style={{ padding: "0.75rem", background: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>Google Gemini</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: 0 }}>Free tier. Image-to-image. This is what this tool uses under the hood.</p>
              </div>
              <div style={{ padding: "0.75rem", background: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>ChatGPT (DALL-E / GPT-4o)</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: 0 }}>Upload image + paste prompt. Works well for pixel art.</p>
              </div>
              <div style={{ padding: "0.75rem", background: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>Midjourney</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: 0 }}>Use /imagine with image URL. Add &quot;--style raw&quot; for pixel art.</p>
              </div>
              <div style={{ padding: "0.75rem", background: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>Any AI Image Tool</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: 0 }}>The prompts work anywhere. Just attach your character image.</p>
              </div>
            </div>
          </div>

          {/* CTA back to Create */}
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Or skip the manual work and let us handle it:
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setActiveTab("create")}
              style={{ fontSize: "1rem", padding: "0.75rem 2rem" }}
            >
              Create Sprites Automatically
            </button>
          </div>
        </div>
      )}

      {/* ========== CREATE TAB ========== */}
      {activeTab === "create" && <>

      {/* Steps indicator */}
      <div className="steps-indicator">
        {[1, 2, 3, 4, 5].map((displayStep) => {
          // Map display step 5 to internal step 6 (sandbox)
          const internalStep = displayStep === 5 ? 6 : displayStep;
          return (
            <div
              key={displayStep}
              className={`step-dot ${currentStep === internalStep ? "active" : ""} ${
                completedSteps.has(internalStep) ? "completed" : ""
              }`}
            />
          );
        })}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Step 1: Generate Character */}
      {currentStep === 1 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">1</span>
            Generate Character
          </h2>

          {/* How it works */}
          <div style={{
            marginBottom: "1.5rem",
            padding: "1rem 1.25rem",
            background: "var(--bg-tertiary)",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
          }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.6, margin: 0 }}>
              Pick a character. AI converts it to pixel art, generates walk/jump/attack/idle sprite sheets, removes backgrounds, and extracts animation frames. Five steps, fully automated.
            </p>
          </div>

          {/* Input mode tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              className={`btn ${characterInputMode === "bear" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setCharacterInputMode("bear")}
              style={{ flex: 1 }}
            >
              TrillionBears
            </button>
            <button
              className={`btn ${characterInputMode === "image" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setCharacterInputMode("image")}
              style={{ flex: 1 }}
            >
              Upload Your Own
            </button>
          </div>

          {characterInputMode === "text" && (
            <div className="input-group">
              <label htmlFor="prompt">Character Prompt</label>
              <textarea
                id="prompt"
                className="text-input"
                rows={3}
                spellCheck={false}
                placeholder="Describe your pixel art character (e.g., 'pixel art knight with sword and shield, medieval armor, 32-bit style')"
                value={characterPrompt}
                onChange={(e) => setCharacterPrompt(e.target.value)}
              />
            </div>
          )}

          {characterInputMode === "image" && (
            <>
              <div className="input-group">
                <label>Upload Image</label>
                {!inputImageUrl ? (
                  <label
                    htmlFor="imageUpload"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "2rem",
                      border: "2px dashed var(--border-color)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "border-color 0.2s, background 0.2s",
                      background: "var(--bg-secondary)",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-color)";
                      e.currentTarget.style.background = "var(--bg-tertiary)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.background = "var(--bg-secondary)";
                    }}
                  >
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: "var(--text-tertiary)", marginBottom: "0.75rem" }}
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                      Click to upload an image
                    </span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                      PNG, JPG, WEBP supported
                    </span>
                    <input
                      id="imageUpload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setInputImageUrl(event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                ) : (
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                      padding: "1rem",
                      border: "2px solid var(--border-color)",
                      borderRadius: "8px",
                      background: "var(--bg-secondary)",
                    }}
                  >
                    <img
                      src={inputImageUrl}
                      alt="Uploaded preview"
                      style={{ maxWidth: "250px", maxHeight: "250px", borderRadius: "4px", display: "block" }}
                    />
                    <button
                      onClick={() => setInputImageUrl("")}
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        border: "none",
                        background: "var(--bg-primary)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.2rem",
                        lineHeight: 1,
                      }}
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <div className="input-group" style={{ marginTop: "1rem" }}>
                <label htmlFor="promptOptional">Additional Instructions (optional)</label>
                <textarea
                  id="promptOptional"
                  className="text-input"
                  rows={2}
                  spellCheck={false}
                  placeholder="Any additional instructions for the pixel art conversion..."
                  value={characterPrompt}
                  onChange={(e) => setCharacterPrompt(e.target.value)}
                />
              </div>
            </>
          )}

          {characterInputMode === "bear" && (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Search bears..."
                  value={bearSearch}
                  onChange={(e) => setBearSearch(e.target.value)}
                  style={{ marginBottom: "0.75rem" }}
                />
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: "0.5rem",
                  maxHeight: "400px",
                  overflowY: "auto",
                  padding: "0.5rem",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                }}>
                  {bearList
                    .filter((name) => name.toLowerCase().includes(bearSearch.toLowerCase()))
                    .map((name) => (
                      <div
                        key={name}
                        onClick={() => {
                          setSelectedBear(name);
                          setCharacterPrompt(name.replace(/BEAR$/i, " Bear"));
                        }}
                        style={{
                          cursor: "pointer",
                          borderRadius: "8px",
                          border: selectedBear === name ? "2px solid var(--accent-color)" : "2px solid transparent",
                          background: selectedBear === name ? "var(--bg-primary)" : "transparent",
                          padding: "0.25rem",
                          textAlign: "center",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                      >
                        <img
                          src={`/bears/${name}.webp`}
                          alt={name}
                          loading="lazy"
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            objectFit: "cover",
                            borderRadius: "6px",
                            display: "block",
                          }}
                        />
                        <div style={{
                          fontSize: "0.6rem",
                          color: selectedBear === name ? "var(--text-primary)" : "var(--text-tertiary)",
                          marginTop: "0.2rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {name.replace(/BEAR$/i, "")}
                        </div>
                      </div>
                    ))
                  }
                </div>
                {bearList.length === 0 && (
                  <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem", marginTop: "0.5rem" }}>Loading bears...</p>
                )}
              </div>
              {selectedBear && (
                <div style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  border: "2px solid var(--accent-color)",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}>
                    <img
                      src={`/bears/${selectedBear}.webp`}
                      alt={selectedBear}
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "2px solid var(--accent-color)",
                      }}
                    />
                    <div>
                      <div style={{
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--accent-color)",
                        fontWeight: 600,
                      }}>
                        Bear Selected
                      </div>
                      <div style={{
                        fontSize: "1.1rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}>
                        {selectedBear.replace(/BEAR$/i, " Bear")}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedBear("");
                        setCharacterPrompt("");
                      }}
                      style={{
                        marginLeft: "auto",
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.8rem",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        background: "transparent",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      Change
                    </button>
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label htmlFor="bearPromptOptional">Additional Instructions (optional)</label>
                    <textarea
                      id="bearPromptOptional"
                      className="text-input"
                      rows={2}
                      spellCheck={false}
                      placeholder="Any additional instructions for the pixel art conversion..."
                      value={characterPrompt}
                      onChange={(e) => setCharacterPrompt(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={generateCharacter}
              disabled={
                isGeneratingCharacter ||
                (characterInputMode === "text" && !characterPrompt.trim()) ||
                (characterInputMode === "image" && !inputImageUrl.trim()) ||
                (characterInputMode === "bear" && !selectedBear)
              }
            >
              {isGeneratingCharacter
                ? "Generating..."
                : characterInputMode === "image" || characterInputMode === "bear"
                ? "Convert to Pixel Art"
                : "Generate Character"}
            </button>
          </div>

          {isGeneratingCharacter && (
            <div className="loading">
              <FalSpinner />
              <span className="loading-text">
                {characterInputMode === "image" || characterInputMode === "bear"
                  ? "Converting to pixel art..."
                  : "Generating your character..."}
              </span>
            </div>
          )}

          {characterImageUrl && (
            <>
              <div className="image-preview">
                <img src={characterImageUrl} alt="Generated character" />
              </div>

              <div className="button-group">
                <button
                  className="btn btn-secondary"
                  onClick={generateCharacter}
                  disabled={isGeneratingCharacter}
                >
                  Regenerate
                </button>
                <button
                  className="btn btn-success"
                  onClick={generateSpriteSheet}
                  disabled={isGeneratingSpriteSheet}
                >
                  {isGeneratingSpriteSheet ? "Creating Sprite Sheet..." : "Use for Sprite Sheet →"}
                </button>
              </div>

              {isGeneratingSpriteSheet && (
                <div className="loading">
                  <FalSpinner />
                  <span className="loading-text">Creating sprite sheets...</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Sprite Sheets Generated */}
      {currentStep === 2 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">2</span>
            Sprite Sheets Generated
          </h2>

          <p className="description-text">
            Walk, jump, and attack sprite sheets have been generated. If poses don&apos;t look right, try regenerating.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Walk (4 frames)</h4>
              {walkSpriteSheetUrl && (
                <div className="image-preview" style={{ margin: 0, opacity: regeneratingSpriteSheet === "walk" ? 0.5 : 1 }}>
                  <img src={walkSpriteSheetUrl} alt="Walk sprite sheet" />
                </div>
              )}
              <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => regenerateSpriteSheet("walk")}
                  disabled={isGeneratingSpriteSheet || regeneratingSpriteSheet !== null || isRemovingBg}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", flex: 1 }}
                >
                  {regeneratingSpriteSheet === "walk" ? "Regen..." : "Regen"}
                </button>
                {walkSpriteSheetUrl && (
                  <button
                    className="btn btn-primary"
                    onClick={() => downloadDataUrl(walkSpriteSheetUrl, "walk-sprite-sheet.png")}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                    title="Download walk sprite sheet"
                  >
                    ↓
                  </button>
                )}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Jump (4 frames)</h4>
              {jumpSpriteSheetUrl && (
                <div className="image-preview" style={{ margin: 0, opacity: regeneratingSpriteSheet === "jump" ? 0.5 : 1 }}>
                  <img src={jumpSpriteSheetUrl} alt="Jump sprite sheet" />
                </div>
              )}
              <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => regenerateSpriteSheet("jump")}
                  disabled={isGeneratingSpriteSheet || regeneratingSpriteSheet !== null || isRemovingBg}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", flex: 1 }}
                >
                  {regeneratingSpriteSheet === "jump" ? "Regen..." : "Regen"}
                </button>
                {jumpSpriteSheetUrl && (
                  <button
                    className="btn btn-primary"
                    onClick={() => downloadDataUrl(jumpSpriteSheetUrl, "jump-sprite-sheet.png")}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                    title="Download jump sprite sheet"
                  >
                    ↓
                  </button>
                )}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Attack (4 frames)</h4>
              {attackSpriteSheetUrl && (
                <div className="image-preview" style={{ margin: 0, opacity: regeneratingSpriteSheet === "attack" ? 0.5 : 1 }}>
                  <img src={attackSpriteSheetUrl} alt="Attack sprite sheet" />
                </div>
              )}
              <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => regenerateSpriteSheet("attack")}
                  disabled={isGeneratingSpriteSheet || regeneratingSpriteSheet !== null || isRemovingBg}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", flex: 1 }}
                >
                  {regeneratingSpriteSheet === "attack" ? "Regen..." : "Regen"}
                </button>
                {attackSpriteSheetUrl && (
                  <button
                    className="btn btn-primary"
                    onClick={() => downloadDataUrl(attackSpriteSheetUrl, "attack-sprite-sheet.png")}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                    title="Download attack sprite sheet"
                  >
                    ↓
                  </button>
                )}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Idle (4 frames)</h4>
              {idleSpriteSheetUrl && (
                <div className="image-preview" style={{ margin: 0, opacity: regeneratingSpriteSheet === "idle" ? 0.5 : 1 }}>
                  <img src={idleSpriteSheetUrl} alt="Idle sprite sheet" />
                </div>
              )}
              <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => regenerateSpriteSheet("idle")}
                  disabled={isGeneratingSpriteSheet || regeneratingSpriteSheet !== null || isRemovingBg}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", flex: 1 }}
                >
                  {regeneratingSpriteSheet === "idle" ? "Regen..." : "Regen"}
                </button>
                {idleSpriteSheetUrl && (
                  <button
                    className="btn btn-primary"
                    onClick={() => downloadDataUrl(idleSpriteSheetUrl, "idle-sprite-sheet.png")}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                    title="Download idle sprite sheet"
                  >
                    ↓
                  </button>
                )}
              </div>
            </div>
          </div>

          {(isGeneratingSpriteSheet || regeneratingSpriteSheet) && (
            <div className="loading">
              <FalSpinner />
              <span className="loading-text">
                {isGeneratingSpriteSheet ? "Regenerating all sprite sheets..." : `Regenerating ${regeneratingSpriteSheet} sprite sheet...`}
              </span>
            </div>
          )}

          <div className="button-group">
            <button className="btn btn-secondary" onClick={() => setCurrentStep(1)}>
              ← Back to Character
            </button>
            <button
              className="btn btn-secondary"
              onClick={generateSpriteSheet}
              disabled={isGeneratingSpriteSheet || isRemovingBg}
            >
              Regenerate All
            </button>
            <button
              className="btn btn-success"
              onClick={removeBackground}
              disabled={isRemovingBg || isGeneratingSpriteSheet || !walkSpriteSheetUrl || !jumpSpriteSheetUrl || !attackSpriteSheetUrl}
            >
              {isRemovingBg ? "Removing Backgrounds..." : "Remove Backgrounds →"}
            </button>
          </div>

          {isRemovingBg && (
            <div className="loading">
              <FalSpinner />
              <span className="loading-text">Removing backgrounds from all sheets...</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Background Removed */}
      {currentStep === 3 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">3</span>
            Backgrounds Removed
          </h2>

          <p className="description-text">
            Backgrounds have been removed. Now let&apos;s extract the individual frames.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Walk Cycle</h4>
              {walkBgRemovedUrl && (
                <>
                  <div className="image-preview" style={{ margin: 0 }}>
                    <img src={walkBgRemovedUrl} alt="Walk sprite sheet with background removed" />
                  </div>
                  <button className="btn btn-primary" onClick={() => downloadDataUrl(walkBgRemovedUrl, "walk-transparent.png")} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", marginTop: "0.5rem", width: "100%" }}>
                    Download Walk Sheet
                  </button>
                </>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Jump</h4>
              {jumpBgRemovedUrl && (
                <>
                  <div className="image-preview" style={{ margin: 0 }}>
                    <img src={jumpBgRemovedUrl} alt="Jump sprite sheet with background removed" />
                  </div>
                  <button className="btn btn-primary" onClick={() => downloadDataUrl(jumpBgRemovedUrl, "jump-transparent.png")} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", marginTop: "0.5rem", width: "100%" }}>
                    Download Jump Sheet
                  </button>
                </>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Attack</h4>
              {attackBgRemovedUrl && (
                <>
                  <div className="image-preview" style={{ margin: 0 }}>
                    <img src={attackBgRemovedUrl} alt="Attack sprite sheet with background removed" />
                  </div>
                  <button className="btn btn-primary" onClick={() => downloadDataUrl(attackBgRemovedUrl, "attack-transparent.png")} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", marginTop: "0.5rem", width: "100%" }}>
                    Download Attack Sheet
                  </button>
                </>
              )}
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Idle</h4>
              {idleBgRemovedUrl && (
                <>
                  <div className="image-preview" style={{ margin: 0 }}>
                    <img src={idleBgRemovedUrl} alt="Idle sprite sheet with background removed" />
                  </div>
                  <button className="btn btn-primary" onClick={() => downloadDataUrl(idleBgRemovedUrl, "idle-transparent.png")} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", marginTop: "0.5rem", width: "100%" }}>
                    Download Idle Sheet
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="button-group">
            <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
              ← Back
            </button>
            <button className="btn btn-success" onClick={proceedToFrameExtraction}>
              Extract Frames →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Frame Extraction */}
      {currentStep === 4 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">4</span>
            Extract Frames
          </h2>

          <p className="description-text">
            Drag the dividers to adjust frame boundaries, or use Auto-detect. Purple = columns, pink = rows.
          </p>

          {/* Smart extraction controls */}
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={handleAutoDetect} style={{ fontSize: "0.8rem" }}>
              Auto-detect Boundaries
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={trimToContent} onChange={(e) => setTrimToContent(e.target.checked)} />
              Trim to content
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={normalizeSize} onChange={(e) => setNormalizeSize(e.target.checked)} disabled={!trimToContent} />
              Normalize frame sizes
            </label>
          </div>

          {/* Tab buttons */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              className={`btn ${activeSheet === "walk" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSheet("walk")}
            >
              Walk Cycle
            </button>
            <button
              className={`btn ${activeSheet === "jump" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSheet("jump")}
            >
              Jump
            </button>
            <button
              className={`btn ${activeSheet === "attack" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSheet("attack")}
            >
              Attack
            </button>
            <button
              className={`btn ${activeSheet === "idle" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSheet("idle")}
            >
              Idle
            </button>
          </div>

          {/* Walk frame extraction */}
          {activeSheet === "walk" && (
            <>
              <div className="frame-controls">
                <label htmlFor="walkGridCols">Columns:</label>
                <input
                  id="walkGridCols"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={walkGridCols}
                  onChange={(e) => setWalkGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 3)))}
                />
                <label htmlFor="walkGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input
                  id="walkGridRows"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={walkGridRows}
                  onChange={(e) => setWalkGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  ({walkGridCols * walkGridRows} frames)
                </span>
              </div>

              {walkBgRemovedUrl && (
                <div className="frame-extractor" ref={containerRef}>
                  <div className="sprite-sheet-container">
                    <img
                      ref={walkSpriteSheetRef}
                      src={walkBgRemovedUrl}
                      alt="Walk sprite sheet"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        setWalkSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                    />
                    <div className="divider-overlay">
                      {walkVerticalDividers.map((pos, index) => (
                        <div
                          key={`wv-${index}`}
                          className="divider-line divider-vertical"
                          style={{ left: `${pos}%` }}
                          onMouseDown={(e) => handleWalkVerticalDividerDrag(index, e)}
                        />
                      ))}
                      {walkHorizontalDividers.map((pos, index) => (
                        <div
                          key={`wh-${index}`}
                          className="divider-line divider-horizontal"
                          style={{ top: `${pos}%` }}
                          onMouseDown={(e) => handleWalkHorizontalDividerDrag(index, e)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {walkExtractedFrames.length > 0 && (
                <>
                  <div className="frames-preview">
                    {walkExtractedFrames.map((frame, index) => (
                      <div key={index} className="frame-thumb" onClick={() => downloadDataUrl(frame.dataUrl, `walk-frame-${index + 1}.png`)} style={{ cursor: "pointer" }} title="Click to download">
                        <img src={frame.dataUrl} alt={`Walk frame ${index + 1}`} />
                        <div className="frame-label">Walk {index + 1} ↓</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button className="btn btn-primary" onClick={exportWalkSpriteSheet} style={{ fontSize: "0.8rem" }}>Download Walk Sheet</button>
                    <button className="btn btn-secondary" onClick={() => exportFramesForType("walk")} style={{ fontSize: "0.8rem" }}>Download Walk Frames</button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Jump frame extraction */}
          {activeSheet === "jump" && (
            <>
              <div className="frame-controls">
                <label htmlFor="jumpGridCols">Columns:</label>
                <input
                  id="jumpGridCols"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={jumpGridCols}
                  onChange={(e) => setJumpGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <label htmlFor="jumpGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input
                  id="jumpGridRows"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={jumpGridRows}
                  onChange={(e) => setJumpGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  ({jumpGridCols * jumpGridRows} frames)
                </span>
              </div>

              {jumpBgRemovedUrl && (
                <div className="frame-extractor">
                  <div className="sprite-sheet-container">
                    <img
                      ref={jumpSpriteSheetRef}
                      src={jumpBgRemovedUrl}
                      alt="Jump sprite sheet"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        setJumpSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                    />
                    <div className="divider-overlay">
                      {jumpVerticalDividers.map((pos, index) => (
                        <div
                          key={`jv-${index}`}
                          className="divider-line divider-vertical"
                          style={{ left: `${pos}%` }}
                          onMouseDown={(e) => handleJumpVerticalDividerDrag(index, e)}
                        />
                      ))}
                      {jumpHorizontalDividers.map((pos, index) => (
                        <div
                          key={`jh-${index}`}
                          className="divider-line divider-horizontal"
                          style={{ top: `${pos}%` }}
                          onMouseDown={(e) => handleJumpHorizontalDividerDrag(index, e)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {jumpExtractedFrames.length > 0 && (
                <>
                  <div className="frames-preview">
                    {jumpExtractedFrames.map((frame, index) => (
                      <div key={index} className="frame-thumb" onClick={() => downloadDataUrl(frame.dataUrl, `jump-frame-${index + 1}.png`)} style={{ cursor: "pointer" }} title="Click to download">
                        <img src={frame.dataUrl} alt={`Jump frame ${index + 1}`} />
                        <div className="frame-label">Jump {index + 1} ↓</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button className="btn btn-primary" onClick={exportJumpSpriteSheet} style={{ fontSize: "0.8rem" }}>Download Jump Sheet</button>
                    <button className="btn btn-secondary" onClick={() => exportFramesForType("jump")} style={{ fontSize: "0.8rem" }}>Download Jump Frames</button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Attack frame extraction */}
          {activeSheet === "attack" && (
            <>
              <div className="frame-controls">
                <label htmlFor="attackGridCols">Columns:</label>
                <input
                  id="attackGridCols"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={attackGridCols}
                  onChange={(e) => setAttackGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <label htmlFor="attackGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input
                  id="attackGridRows"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={attackGridRows}
                  onChange={(e) => setAttackGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  ({attackGridCols * attackGridRows} frames)
                </span>
              </div>

              {attackBgRemovedUrl && (
                <div className="frame-extractor">
                  <div className="sprite-sheet-container">
                    <img
                      ref={attackSpriteSheetRef}
                      src={attackBgRemovedUrl}
                      alt="Attack sprite sheet"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        setAttackSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                    />
                    <div className="divider-overlay">
                      {attackVerticalDividers.map((pos, index) => (
                        <div
                          key={`av-${index}`}
                          className="divider-line divider-vertical"
                          style={{ left: `${pos}%` }}
                          onMouseDown={(e) => handleAttackVerticalDividerDrag(index, e)}
                        />
                      ))}
                      {attackHorizontalDividers.map((pos, index) => (
                        <div
                          key={`ah-${index}`}
                          className="divider-line divider-horizontal"
                          style={{ top: `${pos}%` }}
                          onMouseDown={(e) => handleAttackHorizontalDividerDrag(index, e)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {attackExtractedFrames.length > 0 && (
                <>
                  <div className="frames-preview">
                    {attackExtractedFrames.map((frame, index) => (
                      <div key={index} className="frame-thumb" onClick={() => downloadDataUrl(frame.dataUrl, `attack-frame-${index + 1}.png`)} style={{ cursor: "pointer" }} title="Click to download">
                        <img src={frame.dataUrl} alt={`Attack frame ${index + 1}`} />
                        <div className="frame-label">Attack {index + 1} ↓</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button className="btn btn-primary" onClick={exportAttackSpriteSheet} style={{ fontSize: "0.8rem" }}>Download Attack Sheet</button>
                    <button className="btn btn-secondary" onClick={() => exportFramesForType("attack")} style={{ fontSize: "0.8rem" }}>Download Attack Frames</button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Idle frame extraction */}
          {activeSheet === "idle" && (
            <>
              <div className="frame-controls">
                <label htmlFor="idleGridCols">Columns:</label>
                <input
                  id="idleGridCols"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={idleGridCols}
                  onChange={(e) => setIdleGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <label htmlFor="idleGridRows" style={{ marginLeft: "1rem" }}>Rows:</label>
                <input
                  id="idleGridRows"
                  type="number"
                  className="frame-count-input"
                  min={1}
                  max={8}
                  value={idleGridRows}
                  onChange={(e) => setIdleGridRows(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                />
                <span style={{ marginLeft: "1rem", color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  ({idleGridCols * idleGridRows} frames)
                </span>
              </div>

              {idleBgRemovedUrl && (
                <div className="frame-extractor">
                  <div className="sprite-sheet-container">
                    <img
                      ref={idleSpriteSheetRef}
                      src={idleBgRemovedUrl}
                      alt="Idle sprite sheet"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        setIdleSpriteSheetDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                    />
                    <div className="divider-overlay">
                      {idleVerticalDividers.map((pos, index) => (
                        <div
                          key={`iv-${index}`}
                          className="divider-line divider-vertical"
                          style={{ left: `${pos}%` }}
                          onMouseDown={(e) => handleIdleVerticalDividerDrag(index, e)}
                        />
                      ))}
                      {idleHorizontalDividers.map((pos, index) => (
                        <div
                          key={`ih-${index}`}
                          className="divider-line divider-horizontal"
                          style={{ top: `${pos}%` }}
                          onMouseDown={(e) => handleIdleHorizontalDividerDrag(index, e)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {idleExtractedFrames.length > 0 && (
                <>
                  <div className="frames-preview">
                    {idleExtractedFrames.map((frame, index) => (
                      <div key={index} className="frame-thumb" onClick={() => downloadDataUrl(frame.dataUrl, `idle-frame-${index + 1}.png`)} style={{ cursor: "pointer" }} title="Click to download">
                        <img src={frame.dataUrl} alt={`Idle frame ${index + 1}`} />
                        <div className="frame-label">Idle {index + 1} ↓</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button className="btn btn-primary" onClick={exportIdleSpriteSheet} style={{ fontSize: "0.8rem" }}>Download Idle Sheet</button>
                    <button className="btn btn-secondary" onClick={() => exportFramesForType("idle")} style={{ fontSize: "0.8rem" }}>Download Idle Frames</button>
                  </div>
                </>
              )}
            </>
          )}

          <div className="button-group">
            <button className="btn btn-secondary" onClick={() => setCurrentStep(3)}>
              ← Back
            </button>
            <button
              className="btn btn-success"
              onClick={proceedToSandbox}
              disabled={walkExtractedFrames.length === 0 || jumpExtractedFrames.length === 0 || attackExtractedFrames.length === 0 || idleExtractedFrames.length === 0}
            >
              Try in Sandbox →
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Animation Preview & Export */}
      {currentStep === 5 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">5</span>
            Preview & Export
          </h2>

          <p className="description-text">Walk animation preview. Test both walk and jump in the sandbox!</p>

          <div className="animation-preview">
            <div className="animation-canvas-container">
              <canvas ref={canvasRef} className="animation-canvas" />
              <div className="direction-indicator">
                {direction === "right" ? "→ Walking Right" : "← Walking Left"}
              </div>
            </div>

            <div className="keyboard-hint">
              Hold <kbd>D</kbd> or <kbd>→</kbd> to walk right | Hold <kbd>A</kbd> or <kbd>←</kbd> to walk left | <kbd>Space</kbd> to stop
            </div>

            <div className="animation-controls">
              <button
                className={`btn ${isPlaying ? "btn-secondary" : "btn-primary"}`}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? "Stop" : "Play"}
              </button>

              <div className="fps-control">
                <label>FPS: {fps}</label>
                <input
                  type="range"
                  className="fps-slider"
                  min={1}
                  max={24}
                  value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", margin: "1rem 0" }}>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Walk Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {walkExtractedFrames.map((frame, index) => (
                  <div
                    key={index}
                    className={`frame-thumb ${currentFrameIndex === index ? "active" : ""}`}
                    onClick={() => setCurrentFrameIndex(index)}
                  >
                    <img src={frame.dataUrl} alt={`Walk ${index + 1}`} />
                    <div className="frame-label">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Jump Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {jumpExtractedFrames.map((frame, index) => (
                  <div key={index} className="frame-thumb">
                    <img src={frame.dataUrl} alt={`Jump ${index + 1}`} />
                    <div className="frame-label">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Attack Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {attackExtractedFrames.map((frame, index) => (
                  <div key={index} className="frame-thumb">
                    <img src={frame.dataUrl} alt={`Attack ${index + 1}`} />
                    <div className="frame-label">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Idle Frames</h4>
              <div className="frames-preview" style={{ margin: 0, justifyContent: "flex-start" }}>
                {idleExtractedFrames.map((frame, index) => (
                  <div key={index} className="frame-thumb">
                    <img src={frame.dataUrl} alt={`Idle ${index + 1}`} />
                    <div className="frame-label">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="export-section">
            <h3 style={{ marginBottom: "0.75rem" }}>Export</h3>
            <div className="export-options">
              <button className="btn btn-primary" onClick={exportWalkSpriteSheet}>
                Walk Sheet
              </button>
              <button className="btn btn-primary" onClick={exportJumpSpriteSheet}>
                Jump Sheet
              </button>
              <button className="btn btn-primary" onClick={exportAttackSpriteSheet}>
                Attack Sheet
              </button>
              <button className="btn btn-primary" onClick={exportIdleSpriteSheet}>
                Idle Sheet
              </button>
              <button className="btn btn-secondary" onClick={exportAllFrames}>
                All Frames
              </button>
            </div>
          </div>

          <div className="button-group" style={{ marginTop: "1.5rem" }}>
            <button className="btn btn-secondary" onClick={() => setCurrentStep(4)}>
              ← Back to Frame Extraction
            </button>
            <button
              className="btn btn-success"
              onClick={() => {
                setCompletedSteps((prev) => new Set([...prev, 5]));
                setCurrentStep(6);
              }}
            >
              Try in Sandbox →
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Sandbox */}
      {currentStep === 6 && (
        <div className="step-container">
          <h2 className="step-title">
            <span className="step-number">5</span>
            Sandbox
          </h2>

          <p className="description-text">
            Walk, jump, and attack with your character! Use the keyboard to control movement.
          </p>

          {/* Custom background hidden for now — behaves funky */}

          <div className="sandbox-container">
            <Suspense fallback={
              <div className="loading">
                <FalSpinner />
                <span className="loading-text">Loading sandbox...</span>
              </div>
            }>
              <PixiSandbox
                walkFrames={walkExtractedFrames}
                jumpFrames={jumpExtractedFrames}
                attackFrames={attackExtractedFrames}
                idleFrames={idleExtractedFrames}
                fps={fps}
                customBackgroundLayers={backgroundMode === "custom" ? customBackgroundLayers : undefined}
              />
            </Suspense>
          </div>

          <div className="keyboard-hint" style={{ marginTop: "1rem" }}>
            <kbd>A</kbd>/<kbd>←</kbd> walk left | <kbd>D</kbd>/<kbd>→</kbd> walk right | <kbd>W</kbd>/<kbd>↑</kbd> jump | <kbd>J</kbd> attack
          </div>

          <div className="animation-controls" style={{ marginTop: "1rem" }}>
            <div className="fps-control">
              <label>Animation Speed (FPS): {fps}</label>
              <input
                type="range"
                className="fps-slider"
                min={4}
                max={16}
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="button-group" style={{ marginTop: "1.5rem" }}>
            <button className="btn btn-secondary" onClick={() => setCurrentStep(4)}>
              ← Back to Frame Extraction
            </button>
            <button className="btn btn-secondary" onClick={() => {
              // Reset everything
              setCurrentStep(1);
              setCompletedSteps(new Set());
              setCharacterImageUrl(null);
              setWalkSpriteSheetUrl(null);
              setJumpSpriteSheetUrl(null);
              setAttackSpriteSheetUrl(null);
              setIdleSpriteSheetUrl(null);
              setWalkBgRemovedUrl(null);
              setJumpBgRemovedUrl(null);
              setAttackBgRemovedUrl(null);
              setIdleBgRemovedUrl(null);
              setWalkExtractedFrames([]);
              setJumpExtractedFrames([]);
              setAttackExtractedFrames([]);
              setIdleExtractedFrames([]);
              setCharacterPrompt("");
              setInputImageUrl("");
              setCharacterInputMode("text");
              setBackgroundMode("default");
              setCustomBackgroundLayers({ layer1Url: null, layer2Url: null, layer3Url: null });
            }}>
              Start New Sprite
            </button>
          </div>
        </div>
      )}

      </>}
    </main>
  );
}
