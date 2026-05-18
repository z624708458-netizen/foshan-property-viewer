import type { ThemeConfig } from 'antd'

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#4A90D9',
    colorInfo: '#4A90D9',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorTextBase: '#1A1A1A',
    colorTextSecondary: '#595959',
    colorTextTertiary: '#8C8C8C',
    colorBorder: '#E8E8E8',
    colorBgLayout: '#F5F7FA',
    borderRadius: 6,
    fontFamily: '"Microsoft YaHei", -apple-system, sans-serif',
    fontSize: 14,
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 18,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    lineHeight: 1.5715,
    paddingLG: 24,
    paddingMD: 16,
    paddingSM: 12,
    paddingXS: 8,
  },
  components: {
    Table: {
      headerBg: '#E8F4FD',
      headerColor: '#1A1A1A',
      rowHoverBg: '#F0F7FF',
    },
    Card: {
      paddingLG: 16,
    },
    Button: {
      primaryShadow: '0 2px 4px rgba(74, 144, 217, 0.3)',
    },
  },
}
