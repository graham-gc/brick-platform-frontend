'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Layout, Menu } from 'antd';
import {
  ApiOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/mappings', icon: <AppstoreOutlined />, label: <Link href="/mappings">Swagger Mappings</Link> },
  { key: '/endpoints', icon: <ApiOutlined />, label: <Link href="/endpoints">Endpoint Definitions</Link> },
  { key: '/flows', icon: <PartitionOutlined />, label: <Link href="/flows">Test Flows</Link> },
  { key: '/test-suites', icon: <PlayCircleOutlined />, label: <Link href="/test-suites">Test Suites</Link> },
  { key: '/global-variables', icon: <DatabaseOutlined />, label: <Link href="/global-variables">Global Variables</Link> },
  { key: '/runs', icon: <HistoryOutlined />, label: <Link href="/runs">Run History</Link> },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selectedKey = menuItems.find((item) => pathname.startsWith(item.key))?.key || '/mappings';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
          Brick Platform
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Sider>
      <Layout>
        <Content style={{ padding: '24px', background: '#fff' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
