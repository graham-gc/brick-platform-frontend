import type { Metadata } from "next";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Providers } from './providers';
import '@xyflow/react/dist/style.css';
import "./globals.css";

export const metadata: Metadata = {
  title: "Brick Platform - API Test Automation",
  description: "API test automation platform with Swagger management, flow orchestration, and HAR import",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
