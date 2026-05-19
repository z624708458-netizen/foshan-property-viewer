import { ConfigProvider, Layout, Input, Button, Menu, message, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { SearchOutlined, SyncOutlined, HomeOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { theme } from './styles/theme'
import { useAppStore } from './store/useAppStore'
import { api } from './services/api'
import { useState, lazy, Suspense } from 'react'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DistrictView = lazy(() => import('./pages/DistrictView'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const SearchResult = lazy(() => import('./pages/SearchResult'))
const PriceHistory = lazy(() => import('./pages/PriceHistory'))

const { Sider, Content } = Layout
const { Title } = Typography

const districtItems = [
  { key: 'chancheng', icon: <EnvironmentOutlined />, label: '禅城区' },
  { key: 'nanhai', icon: <EnvironmentOutlined />, label: '南海区' },
  { key: 'shunde', icon: <EnvironmentOutlined />, label: '顺德区' },
  { key: 'sanshui', icon: <EnvironmentOutlined />, label: '三水区' },
  { key: 'gaoming', icon: <EnvironmentOutlined />, label: '高明区' },
]

function App() {
  const { currentPage, selectedDistrict, setPage, selectDistrict, setSearchKeyword } = useAppStore()
  const [searchText, setSearchText] = useState('')
  const [scraping, setScraping] = useState(false)

  const handleSearch = () => {
    if (searchText.trim()) {
      setSearchKeyword(searchText.trim())
    }
  }

  const handleScrape = async () => {
    setScraping(true)
    message.loading({ content: '采集已开始，请查看服务器日志...', key: 'scrape', duration: 0 })
    try {
      await api.startScrape()
      message.success({ content: '采集请求已提交', key: 'scrape' })
    } catch {
      message.error({ content: '采集请求失败', key: 'scrape' })
    }
    setScraping(false)
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'district': return <DistrictView />
      case 'project': return <ProjectDetail />
      case 'search': return <SearchResult />
      case 'history': return <PriceHistory />
      default: return <Dashboard />
    }
  }

  return (
    <ConfigProvider theme={theme} locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #E8E8E8', paddingTop: 16 }}>
          <div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
            <Title level={4} style={{ color: '#4A90D9', margin: 0 }}>佛山楼盘查看器</Title>
          </div>

          <div style={{ padding: '0 16px 16px' }}>
            <Input.Search
              placeholder="搜索楼盘名称"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
            />
          </div>

          <Menu
            mode="inline"
            selectedKeys={[selectedDistrict || '']}
            onClick={({ key }) => selectDistrict(key)}
            items={[
              {
                key: 'home',
                icon: <HomeOutlined />,
                label: '首页',
                onClick: () => setPage('dashboard'),
              },
              { type: 'divider' },
              ...districtItems.map((d) => ({
                key: d.key,
                icon: d.icon,
                label: d.label,
              })),
            ]}
            style={{ borderRight: 0 }}
          />

          <div style={{ position: 'absolute', bottom: 16, width: '100%', padding: '0 16px' }}>
            <Button
              type="primary"
              icon={<SyncOutlined spin={scraping} />}
              block
              onClick={handleScrape}
              disabled={scraping}
            >
              刷新数据
            </Button>
          </div>
        </Sider>

        <Content style={{ padding: 24, background: '#F5F7FA', overflow: 'auto' }}>
          <Suspense fallback={<div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>}>
            {renderContent()}
          </Suspense>
        </Content>
      </Layout>
    </ConfigProvider>
  )
}

export default App