import { useEffect, useState } from 'react';
import { Table, Typography, Button, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api, Project } from '../services/api';
import { useAppStore } from '../store/useAppStore';

const { Title } = Typography;

export default function DistrictView() {
  const { selectedDistrict, selectProject, goBack } = useAppStore();
  const [data, setData] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchPage = (p: number) => {
    if (!selectedDistrict) return;
    setLoading(true);
    api.getProjects(selectedDistrict, p, 30)
      .then((res) => { setData(res.projects); setTotal(res.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); fetchPage(1); }, [selectedDistrict]);

  const fmtPrice = (v: number | null) =>
    v ? v.toLocaleString() : <Tag color="default">暂无</Tag>;

  const columns = [
    {
      title: '项目名称', dataIndex: 'name', key: 'name',
      render: (_: string, r: Project) => <a onClick={() => selectProject(r.id)}>{r.name}</a>,
    },
    {
      title: '面积段(㎡)', key: 'area_range', width: 130,
      render: (_: unknown, r: Project) =>
        r.area_min && r.area_max ? `${r.area_min.toFixed(0)}~${r.area_max.toFixed(0)}` : <Tag color="default">暂无</Tag>,
    },
    {
      title: '平均总价(万)', dataIndex: 'avg_total_price', key: 'avg_total_price', width: 130, align: 'right' as const,
      render: (v: number | null) => v ? (v / 10000).toFixed(1) : <Tag color="default">暂无</Tag>,
      sorter: (a: Project, b: Project) => (a.avg_total_price || 0) - (b.avg_total_price || 0),
    },
    {
      title: '平均单价(元/㎡)', dataIndex: 'avg_unit_price', key: 'avg_unit_price', width: 150, align: 'right' as const,
      render: (_: number | null, r: Project) => fmtPrice(r.avg_unit_price),
      sorter: (a: Project, b: Project) => (a.avg_unit_price || 0) - (b.avg_unit_price || 0),
    },
    {
      title: '底价(元/㎡)', dataIndex: 'floor_price', key: 'floor_price', width: 140, align: 'right' as const,
      render: (_: number | null, r: Project) => r.floor_price ? <span style={{ color: '#4A90D9', fontWeight: 500 }}>{r.floor_price.toLocaleString()}</span> : <Tag color="default">暂无</Tag>,
      defaultSortOrder: 'descend' as const,
      sorter: (a: Project, b: Project) => (a.floor_price || 0) - (b.floor_price || 0),
    },
  ];

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginBottom: 16 }}>返回区域列表</Button>
      <Title level={4}>{total} 个项目</Title>
      <Table
        dataSource={data} columns={columns} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize: 30, total, onChange: (p) => { setPage(p); fetchPage(p); }, showTotal: (t) => `共 ${t} 个项目` }}
        scroll={{ x: 800 }}
      />
    </div>
  );
}