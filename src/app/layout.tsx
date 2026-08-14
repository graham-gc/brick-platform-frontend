import type { Metadata } from "next";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Providers } from './providers';
import "./globals.css";

export const metadata: Metadata = {
  title: "Brick 平台 - 接口自动化测试",
  description: "接口自动化测试平台，支持Swagger文档管理、流程编排、HAR导入",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}