import { describe, expect, it } from 'vitest';
import { analysisResultDocument, isAnalysisTool, workbookProblem } from './analysis-results';

describe('An analysis workbook as an experiment result', () => {
  it('accepts the files the analysis tools export and nothing else', () => {
    expect(workbookProblem({ name: 'qPCR_GAPDH.xlsx', size: 120_000 })).toBeUndefined();
    expect(workbookProblem({ name: 'cnv.CSV', size: 2_000 })).toBeUndefined();
    expect(workbookProblem({ name: 'gel.png', size: 2_000 })).toBe('只接受分析工作台导出的 .xlsx、.xls 或 .csv 文件');
    expect(workbookProblem({ name: 'big.xlsx', size: 26 * 1024 * 1024 })).toBe('文件不能超过 25 MB');
    expect(workbookProblem({ name: 'empty.xlsx', size: 0 })).toBe('请选择导出的工作簿');
  });

  it('knows only its own analysis tools', () => {
    expect(['qpcr-analysis', 'cnv-analysis', 'toString', 'calculator'].filter(isAnalysisTool)).toEqual(['qpcr-analysis', 'cnv-analysis']);
  });

  it('keeps the workbook as a file under 数据与媒体, read by nothing', () => {
    const document = analysisResultDocument({ id: 'att-1', name: 'qPCR_GAPDH.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 120_000 }, 'qPCR 分析');
    const media = document.sections.find(section => section.key === 'data_media')!.blocks;
    expect(media).toEqual([{ id: 'media-att-1', type: 'media', mediaType: 'file', url: '/api/attachments/att-1', attachmentId: 'att-1', filename: 'qPCR_GAPDH.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 120_000, caption: 'qPCR 分析工作台导出的工作簿（未读取其中数值）' }]);
    expect(document.sections.filter(section => section.key !== 'data_media').every(section => !section.blocks.length)).toBe(true);
  });
});
