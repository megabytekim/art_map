"use client";

import { useState, useEffect } from "react";
import { Exhibition, isEndingSoon, getPopularityLevel, getPopularityColor } from "@/lib/types";

interface BlogPost {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  postdate: string;
}

interface Props {
  exhibition: Exhibition | null;
  onClose: () => void;
}

export default function SlideUpCard({ exhibition, onClose }: Props) {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loadingBlogs, setLoadingBlogs] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!exhibition) {
      setBlogs([]);
      setExpanded(false);
      return;
    }

    setExpanded(false);
    setLoadingBlogs(true);
    fetch(
      `/api/blog-search?title=${encodeURIComponent(exhibition.title)}&place=${encodeURIComponent(exhibition.place)}`
    )
      .then((res) => res.json())
      .then((data) => setBlogs(data.items || []))
      .catch(() => setBlogs([]))
      .finally(() => setLoadingBlogs(false));
  }, [exhibition]);

  if (!exhibition) return null;

  const level = getPopularityLevel(exhibition.blogCount);
  const color = getPopularityColor(level);
  const endingSoon = isEndingSoon(exhibition.endDate);

  const naverSearchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(
    `"${exhibition.title}" ${exhibition.place.split(" ")[0]}`
  )}`;

  const blogCount = loadingBlogs ? "..." : blogs.length;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1001] animate-slide-up">
      <div className="bg-white rounded-t-2xl shadow-2xl">
        {/* Handle bar - tap to toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex justify-center pt-2 pb-1 cursor-pointer"
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </button>

        {/* Header - always visible */}
        <div className="px-4 pb-3">
          {/* Image gallery - horizontal scroll */}
          {exhibition.imageUrls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-4 px-4 scrollbar-hide">
              {exhibition.imageUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`${exhibition.title} ${i + 1}`}
                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ))}
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-gray-900 leading-snug line-clamp-1">
                      {exhibition.title}
                    </h3>
                    {endingSoon && (
                      <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        마감 임박
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{exhibition.place}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-gray-400">
                      {exhibition.startDate} ~ {exhibition.endDate}
                    </p>
                    {exhibition.blogCount !== null && (
                      <span className="text-xs font-medium flex items-center gap-1" style={{ color }}>
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        {exhibition.blogCount.toLocaleString()}건
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Blog summary */}
          {!expanded && blogs.length > 0 && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
              {blogs[0].description}
            </p>
          )}

          {/* Expand toggle */}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium"
            >
              관련 블로그 ({blogCount})
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Blog posts - only when expanded */}
        {expanded && (
          <div className="px-4 pb-4 max-h-[45vh] overflow-y-auto">
            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-500 mb-2"
              >
                관련 블로그
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>

              {loadingBlogs ? (
                <div className="flex items-center gap-2 py-3">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full" />
                  <span className="text-xs text-gray-400">불러오는 중...</span>
                </div>
              ) : blogs.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">블로그 글이 없습니다</p>
              ) : (
                <div className="space-y-2.5">
                  {blogs.map((blog, i) => (
                    <a
                      key={i}
                      href={blog.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {blog.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {blog.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">{blog.bloggername}</span>
                        <span className="text-[10px] text-gray-300">
                          {blog.postdate
                            ? `${blog.postdate.slice(0, 4)}.${blog.postdate.slice(4, 6)}.${blog.postdate.slice(6, 8)}`
                            : ""}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              <a
                href={naverSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 mt-3 py-2 text-xs text-green-600 hover:text-green-700 font-medium"
              >
                네이버에서 더 보기
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
