'use client';

import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import { validateImageFile } from '@/lib/utils/validation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ImageUploadProps {
  images: File[];
  onChange: (images: File[]) => void;
  maxImages?: number;
}

interface SortableImageItemProps {
  image: File;
  index: number;
  onRemove: (index: number) => void;
}

const SortableImageItem = React.memo(({ image, index, onRemove }: SortableImageItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `image-${index}` });

  // 이미지 URL 생성 (File 객체가 GC될 때 자동으로 정리됨)
  const imageUrl = useMemo(() => URL.createObjectURL(image), [image]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group"
    >
      <img
        src={imageUrl}
        alt={`이미지 ${index + 1}`}
        className="w-full h-24 object-cover rounded-lg cursor-move"
      />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="text-white text-xl hover:text-accent transition-colors"
          aria-label={`이미지 ${index + 1} 제거`}
        >
          ✕
        </button>
      </div>
      <span className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
        {index + 1}
      </span>
    </div>
  );
});

// displayName 설정 (React DevTools 디버깅용)
SortableImageItem.displayName = 'SortableImageItem';

export default function ImageUpload({
  images,
  onChange,
  maxImages = 25,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(active.id.toString().replace('image-', ''));
      const newIndex = parseInt(over.id.toString().replace('image-', ''));
      onChange(arrayMove(images, oldIndex, newIndex));
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const fileArray = Array.from(files);
      const validFiles: File[] = [];
      setError('');

      for (const file of fileArray) {
        if (!validateImageFile(file)) {
          setError('지원하지 않는 이미지 형식 또는 파일 크기(최대 10MB)를 초과했습니다');
          continue;
        }
        validFiles.push(file);
      }

      const newImages = [...images, ...validFiles];

      if (newImages.length > maxImages) {
        setError(`최대 ${maxImages}장까지만 업로드 가능합니다`);
        return;
      }

      onChange(newImages);
    },
    [images, onChange, maxImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  const removeImage = useCallback((index: number) => {
    onChange(images.filter((_, i) => i !== index));
  }, [images, onChange]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-dark">
        이미지 업로드 ({images.length}/{maxImages})
      </label>

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 bg-white'
        }`}
      >
        <div className="text-center">
          <p className="text-gray-600 mb-2">📸 이미지를 여기에 드래그하거나</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-primary font-medium hover:underline hover:text-primary/80 transition-colors"
          >
            클릭하여 선택
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
          <p className="text-xs text-gray-500 mt-2">
            최대 {maxImages}장, 개당 10MB 이하 (JPG, PNG, WebP, GIF)
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-accent/10 border border-accent text-accent rounded-lg text-sm">
          {error}
        </div>
      )}

      {images.length > 0 && (
        <div>
          <p className="text-sm font-medium text-neutral-dark mb-2">
            업로드된 이미지 (드래그하여 순서 변경):
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={images.map((_, i) => `image-${i}`)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-4 gap-2">
                {images.map((image, index) => (
                  <SortableImageItem
                    key={`image-${index}`}
                    image={image}
                    index={index}
                    onRemove={removeImage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
