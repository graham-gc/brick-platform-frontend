'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Layout, Menu } from 'antd';
import {
  ApiOutlined,
  PartitionOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/mappings', icon: <AppstoreOutlined />, label: <Link href="/mappings">Swagger映射</Link> },
  { key: '/endpoints', icon: <ApiOutlined />, label: <Link href="/endpoints">接口定义</Link> },
  { key: '/flows', icon: <PartitionOutlined />, label: <Link href="/flows">流程管理</Link> },
  { key: '/test-suites', icon: <PlayCircleOutlined />, label: <Link href="/test-suites">测试集</Link> },
  { key: '/global-variables', icon: <DatabaseOutlined />, label: <Link href="/global-variables">全域变量</Link> },
  { key: '/runs', icon: <HistoryOutlined />, label: <Link href="/runs">执行历史</Link> },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selectedKey = menuItems.find((item) => pathname.startsWith(item.key))?.key || '/mappings';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
          Brick 平台
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