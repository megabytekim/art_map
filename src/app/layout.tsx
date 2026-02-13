import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "무하한 - 서울 전시 지도",
  description: "서울 진행중 전시를 지도에서 확인하고, 블로그 인기도를 한눈에 파악하세요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
