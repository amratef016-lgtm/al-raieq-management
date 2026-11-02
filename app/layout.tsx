import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "منظومة الرايق | إدارة الأعمال", description: "نظام إدارة مطحن وكافيه الرايق" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar" dir="rtl"><body>{children}</body></html>; }
