import { useEffect, useState } from 'react';
import { Typography, Button, Spin, Empty } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { api, PriceSnapshot } from '../services/api';
import { useAppStore } from '../store/useAppStore';

const { Title } = Typography;

export default function PriceHistory() {
  const { historyUnitId, goBack } = useAppStore();
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (historyUnitId) {
      setLoading(true);
      api.getPriceHistory(historyUnitId).then((data) => {
        setSnapshots(data);
        setLoading(false);
      });
    }
  }, [historyUnitId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!snapshots.length) return <Empty description="暂无价格历史数据" />;

  const option = {
    title: { text: '价格走势', left: 'center' },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown[]) => {
        const p = params as { axisValueLabel: string; data: number }[];
        return `${p[0].axisValueLabel}<br/>单价: ${p[0].data.toLocaleString()} 元/㎡`;
      },
    },
    xAxis: {
      type: 'category' as const,
      data: snapshots.map((s) => s.snapshot_date),
      axisLabel: { rotate: 30 },
    },
    yAxis: {
      type: 'value' as const,
      name: '单价 (元/㎡)',
    },
    series: [
      {
        name: '单价',
        type: 'line',
        data: snapshots.map((s) => s.unit_price),
        smooth: true,
        itemStyle: { color: '#4A90D9' },
        areaStyle: { color: 'rgba(74, 144, 217, 0.1)' },
      },
      {
        name: '9折后单价',
        type: 'line',
        data: snapshots.map((s) => s.discounted_unit_price),
        smooth: true,
        itemStyle: { color: '#52C41A' },
        lineStyle: { type: 'dashed' },
      },
    ],
    grid: { left: 60, right: 30, top: 50, bottom: 60 },
  };

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={goBack} style={{ marginBottom: 16 }}>
        返回房源列表
      </Button>
      <ReactECharts option={option} style={{ height: 400 }} />
    </div>
  );
}