import { useEffect, useState, useMemo } from 'react';
import { Typography, Button, Tag, Table, Card, Row, Col, Statistic, Radio } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, DollarOutlined, ExpandOutlined } from '@ant-design/icons';
import { api, Building, Unit, Project } from '../services/api';
import { useAppStore } from '../store/useAppStore';

const { Title, Text } = Typography;

export default function ProjectDetail() {
  const { selectedProject, goBack } = useAppStore();
  const [project, setProject] = useState<Project | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedProject) {
      setLoading(true);
      setSelectedBuilding('all');
      Promise.all([api.getProject(selectedProject), api.getUnits(selectedProject)])
        .then(([pData, uData]) => {
          setProject(pData.project);
          setBuildings(pData.buildings);
          setUnits(uData);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedProject]);

  // 按楼栋分组统计
  const buildingStats = useMemo(() => {
    const map: Record<string, { name: string; total: number; withPrice: number }> = {};
    units.forEach((u) => {
      const bid = u.building_id || 'unknown';
      if (!map[bid]) map[bid] = { name: bid, total: 0, withPrice: 0 };
      map[bid].total++;
      if (u.unit_price) map[bid].withPrice++;
    });
    // 匹配楼栋名称
    buildings.forEach((b) => {
      if (map[b.id]) map[b.id].name = b.name;
    });
    return Object.entries(map).map(([id, s]) => ({ id, ...s }));
  }, [units, buildings]);

  // 筛选房源
  const filteredUnits = useMemo(() => {
    if (selectedBuilding === 'all') return units;
    return units.filter((u) => u.building_id === selectedBuilding);
  }, [units, selectedBuilding]);

  // 统计（只算有价格的住宅）
  const pricedUnits = useMemo(() => units.filter((u) => u.unit_price), [units]);
  const areaRange = useMemo(() => {
    const areas = pricedUnits.map((u) => u.area).filter(Boolean) as number[];
    return areas.length ? { min: Math.min(...areas), max: Math.max(...areas) } : null;
  }, [pricedUnits]);
  const priceRange = useMemo(() => {
    const prices = pricedUnits.map((u) => u.unit_price).filter(Boolean) as number[];
    return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
  }, [pricedUnits]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>;
  if (!project) return <div>未找到项目</div>;

  const columns = [
    { title: '房号', dataIndex: 'room_number', width: 120 },
    { title: '户型', dataIndex: 'unit_type', width: 70 },
    { title: '面积(㎡)', dataIndex: 'area', width: 90, align: 'right' as const, render: (v: number | null) => v ? v.toFixed(2) : '-' },
    {
      title: '总价(万)', dataIndex: 'total_price', width: 100, align: 'right' as const,
      render: (v: number | null) => v ? (v / 10000).toFixed(1) : '-',
      sorter: (a: Unit, b: Unit) => (a.total_price || 0) - (b.total_price || 0),
    },
    {
      title: '单价(元/㎡)', dataIndex: 'unit_price', width: 110, align: 'right' as const,
      render: (v: number | null) => v ? v.toLocaleString() : <Tag color="default">暂无</Tag>,
      sorter: (a: Unit, b: Unit) => (a.unit_price || 0) - (b.unit_price || 0),
    },
    {
      title: '9折后单价', dataIndex: 'discounted_unit_price', width: 120, align: 'right' as const,
      render: (v: number | null) => v ? <Text strong style={{ color: '#4A90D9' }}>{v.toLocaleString()}</Text> : '-',
      sorter: (a: Unit, b: Unit) => (a.discounted_unit_price || 0) - (b.discounted_unit_price || 0),
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => {
        const colors: Record<string, string> = { '可售': 'green', '已预定': 'orange', '已签约': 'red', '已备案': 'blue' };
        return <Tag color={colors[s] || 'default'}>{s}</Tag>;
      },
    },
  ];

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginBottom: 16 }}>返回项目列表</Button>
      <Title level={4} style={{ marginBottom: 16 }}>{project.name}</Title>

      {/* 概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}><Card size="small"><Statistic title="总房源" value={units.length} suffix="套" prefix={<HomeOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="有价住宅" value={pricedUnits.length} suffix="套" prefix={<DollarOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="面积段" value={areaRange ? `${areaRange.min}~${areaRange.max}` : '-'} suffix="㎡" prefix={<ExpandOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="单价区间" value={priceRange ? `${(priceRange.min/10000).toFixed(1)}~${(priceRange.max/10000).toFixed(1)}` : '-'} suffix="万/㎡" prefix={<DollarOutlined />} /></Card></Col>
      </Row>

      {/* 楼栋筛选 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text strong style={{ marginRight: 12 }}>楼栋筛选：</Text>
        <Radio.Group
          value={selectedBuilding}
          onChange={(e) => setSelectedBuilding(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="all">全部 ({units.length})</Radio.Button>
          {buildingStats.map((b) => (
            <Radio.Button key={b.id} value={b.id}>
              {b.name} ({b.total}套{b.withPrice > 0 ? ` / ${b.withPrice}可售` : ''})
            </Radio.Button>
          ))}
        </Radio.Group>
      </Card>

      {/* 房源表格 */}
      <Table
        dataSource={filteredUnits}
        columns={columns}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 30, showTotal: (t) => `共 ${t} 套` }}
        scroll={{ x: 750 }}
      />
    </div>
  );
}