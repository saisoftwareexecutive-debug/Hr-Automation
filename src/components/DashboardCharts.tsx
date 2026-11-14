'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from 'recharts';
import { KanbanSquare, TrendingUp } from 'lucide-react';

interface DashboardChartsProps {
  stageData: { name: string; count: number; fill?: string }[];
  dailyData: { day: string; applicants: number }[];
}

const STAGE_COLORS_LIGHT: Record<string, string> = {
  'New': '#94a3b8',
  'Form Sent': '#0284c7',
  'Replied': '#4f46e5',
  'Shortlisted': '#7c3aed',
  'Interview': '#d97706',
  'Selected': '#059669',
  'Rejected': '#e11d48',
};

const STAGE_COLORS_DARK: Record<string, string> = {
  'New': '#64748b',
  'Form Sent': '#38bdf8',
  'Replied': '#818cf8',
  'Shortlisted': '#a78bfa',
  'Interview': '#fbbf24',
  'Selected': '#34d399',
  'Rejected': '#fb7185',
};

export function DashboardCharts({ stageData = [], dailyData = [] }: DashboardChartsProps) {
  const safeStageData = Array.isArray(stageData) ? stageData : [];
  const safeDailyData = Array.isArray(dailyData) ? dailyData : [];
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    updateTheme();

    window.addEventListener('hireflow-theme-change', updateTheme);
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('hireflow-theme-change', updateTheme);
      observer.disconnect();
    };
  }, []);

  const gridStroke = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#475569';
  const tooltipBg = isDark ? '#1e293b' : '#0f172a';
  const tooltipBorder = isDark ? '#475569' : '#1e293b';
  const tooltipText = isDark ? '#f8fafc' : '#ffffff';
  const areaStroke = isDark ? '#34d399' : '#059669';

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Funnel / Pipeline Stage Chart */}
      <div className="bg-surface rounded-2xl p-6 border border-border shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              <KanbanSquare className="w-5 h-5 text-brand" /> Pipeline Funnel by Stage
            </h2>
            <p className="text-xs text-muted">Distribution of candidates across hiring milestones</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safeStageData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: axisColor }}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderRadius: '12px',
                  color: tooltipText,
                  fontSize: '12px',
                  border: `1px solid ${tooltipBorder}`,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                }}
                itemStyle={{ color: tooltipText }}
                formatter={(val: number) => [`${val} candidates`, 'Applicants']}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {safeStageData.map((entry, index) => {
                  const palette = isDark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT;
                  const color = palette[entry.name] || (isDark ? '#818cf8' : '#4f46e5');
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Applicant Inflow Trend */}
      <div className="bg-surface rounded-2xl p-6 border border-border shadow-xs flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Applicant Inflow (Past 7 Days)
            </h2>
            <p className="text-xs text-muted">Daily volume of WorkIndia uploads & incoming candidates</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={safeDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorApplicants" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={areaStroke} stopOpacity={isDark ? 0.45 : 0.35} />
                  <stop offset="95%" stopColor={areaStroke} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderRadius: '12px',
                  color: tooltipText,
                  fontSize: '12px',
                  border: `1px solid ${tooltipBorder}`,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                }}
                itemStyle={{ color: tooltipText }}
                formatter={(val: number) => [`${val} candidates`, 'Volume']}
              />
              <Area
                type="monotone"
                dataKey="applicants"
                stroke={areaStroke}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorApplicants)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
