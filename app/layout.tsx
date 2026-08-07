import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "사이 | 우리 둘의 메신저", description: "가까운 사람과 나누는 작고 편안한 대화" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}</body></html>; }
