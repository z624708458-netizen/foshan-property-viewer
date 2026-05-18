import { useEffect, useState } from 'react';
import { Table, Typography, Button, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api, Project } from '../services/api';
import { useAppStore } from '../store/useAppStore';

const { Title } = Typography;

export default function SearchResult() {
  const { searchKeyword, selectProject, goBack } = useAppStore();
  const [results, setResults] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (searchKeyword) {
      setLoading(true);
      api.searchProjects(searchKeyword).then((data) => {
        setResults(data);
        setLoading(false);
      });
    }
  }, [searchKeyword]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: Project) => (
        <a onClick={() => selectProject(record.id)}>{record.name}</a>
      ),
    },
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    {
      title: '区域',
      dataIndex: 'district_name',
      key: 'district',
      width: 80,
    },
  ];

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginBottom: 16 }}>
        返回
      </Button>
      <Title level={4}>搜索 "{searchKeyword}" — {results.length} 个结果</Title>
      <Table dataSource={results} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} />
    </div>
  );
}