import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, Tag } from 'antd';
import { EnvironmentOutlined, HomeOutlined, DatabaseOutlined } from '@ant-design/icons';
import { api, District, Stats } from '../services/api';
import { useAppStore } from '../store/useAppStore';

const { Title, Text } = Typography;

export default function Dashboard() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectDistrict, goBack } = useAppStore();

  useEffect(() => {
    goBack();
    Promise.all([api.getDistricts(), api.getStats()])
      .then(([d, s]) => {
        setDistricts(d);
        setStats(s);
      })
      .catch((err) => console.error('Dashboard error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>佛山楼盘数据查看器</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card><Statistic title="项目总数" value={stats?.project_count || 0} prefix={<HomeOutlined />} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="房源总数" value={stats?.unit_count || 0} prefix={<DatabaseOutlined />} /></Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="最后更新" value={stats?.last_scrape ? stats.last_scrape.substring(0, 10) : '暂无'} />
          </Card>
        </Col>
      </Row>

      <Title level={4} style={{ marginBottom: 16 }}>选择区域</Title>
      <Row gutter={[16, 16]}>
        {districts.map((d) => (
          <Col key={d.id} span={4}>
            <Card
              hoverable
              onClick={() => selectDistrict(d.id)}
              style={{
                textAlign: 'center',
                borderColor: '#E8F4FD',
                background: '#FAFCFF',
              }}
            >
              <EnvironmentOutlined style={{ fontSize: 32, color: '#4A90D9', marginBottom: 8 }} />
              <div style={{ fontSize: 18, fontWeight: 500, color: '#1A1A1A' }}>{d.name}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}