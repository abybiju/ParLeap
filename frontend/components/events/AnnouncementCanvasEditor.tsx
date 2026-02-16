'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import type Konva from 'konva';

const STAGE_WIDTH = 600;
const STAGE_HEIGHT = 400;
const ERASER_STROKE = '#ffffff';
const ERASER_SIZE = 24;

export interface AnnouncementCanvasEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Image URL or object URL from File */
  imageSource: string;
  onSave: (dataUrl: string) => void;
}

export function AnnouncementCanvasEditor({
  open,
  onOpenChange,
  imageSource,
  onSave,
}: AnnouncementCanvasEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  /** Each stroke is an array of [x, y, x, y, ...] */
  const [strokes, setStrokes] = useState<number[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    if (!imageSource || !open) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      const scale = Math.min(STAGE_WIDTH / img.width, STAGE_HEIGHT / img.height);
      setImageSize({
        w: img.width * scale,
        h: img.height * scale,
      });
    };
    img.src = imageSource;
    return () => {
      img.src = '';
    };
  }, [imageSource, open]);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!imageSize) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      setIsDrawing(true);
      setStrokes((prev) => [...prev, [pos.x, pos.y]]);
    },
    [imageSize]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing || !imageSize) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      setStrokes((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last) next[next.length - 1] = [...last, pos.x, pos.y];
        return next;
      });
    },
    [isDrawing, imageSize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleSave = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    onSave(dataUrl);
    onOpenChange(false);
    setStrokes([]);
  }, [onSave, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
    setStrokes([]);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Clean image (eraser)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-400">
          Draw over text or areas to cover them. Uses a simple brush (no AI). Save to use the cleaned image.
        </p>
        <div className="flex justify-center rounded-lg border border-white/10 bg-slate-800/50 overflow-hidden">
          {image && imageSize && (
            <Stage
              ref={stageRef}
              width={STAGE_WIDTH}
              height={STAGE_HEIGHT}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <Layer>
                <KonvaImage
                  image={image}
                  width={imageSize.w}
                  height={imageSize.h}
                  x={(STAGE_WIDTH - imageSize.w) / 2}
                  y={(STAGE_HEIGHT - imageSize.h) / 2}
                  listening={false}
                />
              </Layer>
              <Layer>
                {strokes.map((points, i) => (
                  <Line
                    key={i}
                    points={points}
                    stroke={ERASER_STROKE}
                    strokeWidth={ERASER_SIZE}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                  />
                ))}
              </Layer>
            </Stage>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleCancel} className="border-white/20">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Save cleaned image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
