import { useEffect, useState, useMemo } from 'react';
import { Typography, Button, Spin, Tag, Table, Select, Card, Row, Col, Statistic } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, DollarOutlined, ExpandOutlined } from '@ant-design/icons';
import { api, Building, Unit, Project } from '../services/api';
import { useAppStore } from '../store/useAppStore';

const { Title, Text } = Typography;

export default function ProjectDetail() {
  const { selectedProject, goBack, viewPriceHistory } = useAppStore();
  const [project, setProject] = useState<Project | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedProject) {
      setLoading(true);
      Promise.all([api.getProject(selectedProject), api.getUnits(selectedProject)])
        .then(([pData, uData]) => {
          setProject(pData.project);
          setBuildings(pData.buildings);
          setUnits(uData);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedProject]);

  // 只统计有价格的住宅房源
  const residentialUnits = useMemo(
    () => units.filter((u) => u.unit_price),
    [units]
  );

  // 面积段
  const areaRange = useMemo(() => {
    const areas = residentialUnits.map((u) => u.area).filter(Boolean) as number[];
    if (!areas.length) return null;
    return { min: Math.min(...areas), max: Math.max(...areas) };
  }, [residentialUnits]);

  // 价格区间
  const priceRange = useMemo(() => {
    const prices = residentialUnits.map((u) => u.unit_price).filter(Boolean) as number[];
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [residentialUnits]);

  const totalPriceRange = useMemo(() => {
    const totals = residentialUnits.map((u) => u.total_price).filter(Boolean) as number[];
    if (!totals.length) return null;
    return { min: Math.min(...totals), max: Math.max(...totals) };
  }, [residentialUnits]);

  const filteredUnits = selectedBuilding
    ? residentialUnits.filter((u) => u.building_id === selectedBuilding)
    : residentialUnits;

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  if (!project) return <div>未找到项目</div>;

  const columns = [
    { title: '房号', dataIndex: 'room_number', width: 120 },
    { title: '户型', dataIndex: 'unit_type', width: 70 },
    {
      title: '面积(㎡)', dataIndex: 'area', width: 90, align: 'right' as const,
      render: (v: number | null) => v ? v.toFixed(2) : '-',
    },
    {
      title: '总价(万)', dataIndex: 'total_price', width: 100, align: 'right' as const,
      render: (v: number | null) => v ? (v / 10000).toFixed(1) : '-',
      sorter: (a: Unit, b: Unit) => (a.total_price || 0) - (b.total_price || 0),
    },
    {
      title: '单价(元/㎡)', dataIndex: 'unit_price', width: 110, align: 'right' as const,
      render: (v: number | null) => v ? v.toLocaleString() : '-',
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
      <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginBottom: 16 }}>
        返回项目列表
      </Button>

      <Title level={4} style={{ marginBottom: 16 }}>{project.name}</Title>

      {/* 项目概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="住宅可售" value={residentialUnits.length} suffix="套" prefix={<HomeOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="面积段"
              value={areaRange ? `${areaRange.min}~${areaRange.max}` : '-'}
              suffix="㎡"
              prefix={<ExpandOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="单价区间"
              value={priceRange ? `${(priceRange.min/10000).toFixed(1)}~${(priceRange.max/10000).toFixed(1)}` : '-'}
              suffix="万/㎡"
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总价区间"
              value={totalPriceRange ? `${(totalPriceRange.min/10000).toFixed(0)}~${(totalPriceRange.max/10000).toFixed(0)}` : '-'}
              suffix="万"
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 楼栋筛选 */}
      {buildings.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text style={{ marginRight: 8 }}>楼栋：</Text>
          <Select
            allowClear placeholder="全部楼栋" style={{ width: 200 }}
            onChange={(v) => setSelectedBuilding(v || null)}
            options={buildings.map((b) => ({ label: b.name, value: b.id }))}
          />
        </div>
      )}

      {/* 房源表格 */}
      <Table
        dataSource={filteredUnits}
        columns={columns}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 30, showTotal: (t) => `共 ${t} 套住宅` }}
        scroll={{ x: 750 }}
        locale={{ emptyText: '暂无可售住宅房源（已售/已预定房源价格被政府隐藏）' }}
      />
    </div>
  );
}