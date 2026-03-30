import React from 'react';
import Chip, { type ChipProps } from '@mui/material/Chip';
import CheckCircle from '@mui/icons-material/CheckCircle';
import CloudUpload from '@mui/icons-material/CloudUpload';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import PlayArrow from '@mui/icons-material/PlayArrow';

export type JobStatus =
  | 'queued'
  | 'created'
  | 'running'
  | 'processing'
  | 'uploading'
  | 'completed'
  | 'failed';

type ChipSx = Record<string, unknown>;

type StatusConfig = {
  label: string;
  icon: React.ReactElement;
  sx: ChipSx;
};

const statusConfig: Record<JobStatus, StatusConfig> = {
  queued: {
    label: '대기 중',
    icon: <HourglassEmpty fontSize="small" />,
    sx: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: 'rgba(226, 232, 240, 0.96)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      '& .MuiChip-icon': {
        color: 'rgba(226, 232, 240, 0.9)',
      },
    },
  },
  created: {
    label: '생성됨',
    icon: <HourglassEmpty fontSize="small" />,
    sx: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: 'rgba(226, 232, 240, 0.96)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      '& .MuiChip-icon': {
        color: 'rgba(226, 232, 240, 0.9)',
      },
    },
  },
  running: {
    label: '실행 중',
    icon: <PlayArrow fontSize="small" />,
    sx: {
      backgroundColor: 'rgba(33, 150, 243, 0.2)',
      color: '#93c5fd',
      border: '1px solid rgba(33, 150, 243, 0.45)',
      '& .MuiChip-icon': {
        color: '#93c5fd',
      },
    },
  },
  processing: {
    label: '처리중',
    icon: <PlayArrow fontSize="small" />,
    sx: {
      backgroundColor: 'rgba(33, 150, 243, 0.2)',
      color: '#93c5fd',
      border: '1px solid rgba(33, 150, 243, 0.45)',
      '& .MuiChip-icon': {
        color: '#93c5fd',
      },
    },
  },
  uploading: {
    label: '업로드 중',
    icon: <CloudUpload fontSize="small" />,
    sx: {
      backgroundColor: 'rgba(255, 167, 38, 0.2)',
      color: '#fdba74',
      border: '1px solid rgba(255, 167, 38, 0.45)',
      '& .MuiChip-icon': {
        color: '#fdba74',
      },
    },
  },
  completed: {
    label: '완료',
    icon: <CheckCircle fontSize="small" />,
    sx: {
      backgroundColor: 'rgba(102, 187, 106, 0.2)',
      color: '#86efac',
      border: '1px solid rgba(102, 187, 106, 0.45)',
      '& .MuiChip-icon': {
        color: '#86efac',
      },
    },
  },
  failed: {
    label: '실패',
    icon: <ErrorIcon fontSize="small" />,
    sx: {
      backgroundColor: 'rgba(244, 67, 54, 0.2)',
      color: '#fca5a5',
      border: '1px solid rgba(244, 67, 54, 0.45)',
      '& .MuiChip-icon': {
        color: '#fca5a5',
      },
    },
  },
};

const isJobStatus = (value: string): value is JobStatus => value in statusConfig;

interface StatusChipProps {
  status?: JobStatus | string | null;
  size?: ChipProps['size'];
}

const baseChipSx: ChipSx = {
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '999px',
  height: 'auto',
  '& .MuiChip-label': {
    display: 'inline-flex',
    alignItems: 'center',
    paddingTop: '0.2em',
    paddingBottom: '0.2em',
  },
  '& .MuiChip-icon': {
    marginLeft: '8px',
  },
};

const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'small' }) => {
  const normalizedStatus = status ?? '';

  if (!normalizedStatus || !isJobStatus(normalizedStatus)) {
    return (
      <Chip
        label={normalizedStatus || '-'}
        size={size}
        variant="outlined"
        sx={{
          ...baseChipSx,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: 'rgba(226, 232, 240, 0.92)',
          borderColor: 'rgba(255, 255, 255, 0.16)',
        }}
      />
    );
  }

  const config = statusConfig[normalizedStatus];

  return (
      <Chip
        icon={config.icon}
        label={config.label}
        size={size}
        variant="outlined"
        sx={{ ...baseChipSx, ...config.sx }}
      />
  );
};

export { statusConfig };
export default StatusChip;
