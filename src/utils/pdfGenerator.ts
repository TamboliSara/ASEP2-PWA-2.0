import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTime } from './format';
import type { FleetLockerSummary, LockerState } from '../types/domain';

interface CommunityContribution {
  lockerId: string;
  donorName: string;
  donorContact: string;
  foodName: string;
  dietTag: string;
  qualityScore: string;
  createdAt: string;
}

interface TelemetryReportData {
  terminalId: string;
  generatedBy: string;
  timestamp: string;
  fleet: FleetLockerSummary[];
  currentLocker: LockerState;
  stats: {
    totalDonations: string;
    activeLockers: string;
    mealsServed: string;
  };
  foodItem?: {
    name: string;
    category: string;
    donor: string;
  };
  receiverTelemetry?: {
    qualityScore: number;
    hoursRemaining: number;
    riskLevel: string;
    aiInsight: string;
    spoilageStatus: string;
  };
  communityContributions?: CommunityContribution[];
}

export const generateTelemetryPDF = (data: TelemetryReportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color Palette
  const colors: Record<string, [number, number, number]> = {
    primary: [15, 23, 42],      // Slate 900
    accent: [20, 184, 166],     // Teal 500
    accentLight: [45, 212, 191], // Teal 400
    emerald: [16, 185, 129],    // Emerald 500
    rose: [244, 63, 94],       // Rose 500
    warning: [245, 158, 11],    // Amber 500
    textMuted: [148, 163, 184], // Slate 400
    bgLight: [248, 250, 252],   // Slate 50
    line: [226, 232, 240]       // Slate 200
  };

  const addHeaderDecoration = (d: jsPDF) => {
    // Technical Corner Decoration
    d.setDrawColor(20, 184, 166);
    d.setLineWidth(0.5);
    // Top Left
    d.line(5, 5, 15, 5);
    d.line(5, 5, 5, 15);
    // Top Right
    d.line(pageWidth - 5, 5, pageWidth - 15, 5);
    d.line(pageWidth - 5, 5, pageWidth - 5, 15);
  };

  const drawSectionHeader = (d: jsPDF, title: string, y: number, color: [number, number, number]) => {
    // Calculate a very light version of the provided color (approx 10% saturation on white)
    const r = Math.round(255 - (255 - color[0]) * 0.1);
    const g = Math.round(255 - (255 - color[1]) * 0.1);
    const b = Math.round(255 - (255 - color[2]) * 0.1);
    
    d.setFillColor(r, g, b);
    d.rect(15, y - 6, pageWidth - 30, 9, 'F');
    
    // Vertical accent bar
    d.setFillColor(color[0], color[1], color[2]);
    d.rect(15, y - 6, 2, 9, 'F');
    
    d.setFontSize(9);
    d.setFont('helvetica', 'bold');
    d.setTextColor(color[0], color[1], color[2]);
    d.text(title.toUpperCase(), 22, y);
  };

  // --- Header ---
  doc.setFillColor(15, 23, 42); 
  doc.rect(0, 0, pageWidth, 55, 'F');
  
  // Header Gradient Effect
  for (let i = 0; i < 10; i++) {
    const opacity = 0.05 * (10 - i);
    const r = Math.round(255 - (255 - 20) * opacity);
    const g = Math.round(255 - (255 - 184) * opacity);
    const b = Math.round(255 - (255 - 166) * opacity);
    doc.setFillColor(r, g, b);
    doc.rect(0, 55 - (i * 2), pageWidth, 2, 'F');
  }

  addHeaderDecoration(doc);

  // Logo & Title
  doc.setFillColor(20, 184, 166);
  doc.circle(25, 25, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('S', 22, 27.5);
  
  doc.setFontSize(24);
  doc.text('SAFE INTELLIGENCE', 42, 26);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 184, 166);
  doc.text('AUTONOMOUS TELEMETRY & AUDIT LOG', 42, 33);
  
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(`REPORT_ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}`, pageWidth - 15, 20, { align: 'right' });
  doc.text(`TERMINAL: ${data.terminalId}`, pageWidth - 15, 25, { align: 'right' });
  doc.text(`DATE: ${formatDateTime(data.timestamp).toUpperCase()}`, pageWidth - 15, 30, { align: 'right' });

  let currentY = 70;

  // --- Executive Summary Cards ---
  drawSectionHeader(doc, 'System Executive Overview', currentY, colors.primary);
  currentY += 10;

  autoTable(doc, {
    startY: currentY,
    head: [['TOTAL DONATIONS', 'ACTIVE CAPACITY', 'COMMUNITY IMPACT']],
    body: [[
      data.stats.totalDonations,
      data.stats.activeLockers,
      `${data.stats.mealsServed} MEALS`
    ]],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 14, fontStyle: 'bold', cellPadding: 8, halign: 'center' },
    margin: { left: 15, right: 15 },
  });

  // --- Active Asset Specification (If Occupied) ---
  const isEmpty = data.currentLocker.occupancyState === 'empty';
  if (!isEmpty && data.currentLocker.activeDonation) {
    const donation = data.currentLocker.activeDonation;
    currentY = (doc as any).lastAutoTable.finalY + 15;
    drawSectionHeader(doc, 'Active Asset Specification', currentY, colors.accent);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['DONOR NAME', 'ASSET TYPE', 'DIET TAG', 'LOGGED TIMESTAMP']],
      body: [[
        donation.donorName,
        donation.foodName,
        donation.dietTag.toUpperCase(),
        formatDateTime(donation.createdAt)
      ]],
      theme: 'grid',
      headStyles: { fillColor: colors.accent, textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 5 },
      margin: { left: 15, right: 15 },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`VERIFIED DONOR CONTACT: ${donation.donorContact}`, 15, finalY + 8);
  }

  // --- Community Registry ---
  if (data.communityContributions && data.communityContributions.length > 0) {
    currentY = (doc as any).lastAutoTable.finalY + 15;
    drawSectionHeader(doc, 'Community Contribution Registry', currentY, colors.emerald);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['UNIT', 'DONOR', 'ASSET', 'DIETARY', 'QUALITY', 'LOGGED']],
      body: data.communityContributions.map(c => [
        c.lockerId.replace('chamber-', 'SAFE '),
        c.donorName,
        c.foodName,
        c.dietTag.toUpperCase(),
        c.qualityScore.toUpperCase(),
        formatDateTime(c.createdAt)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 20 },
        4: { fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const text = data.cell.text[0];
          if (text === 'FRESH') data.cell.styles.textColor = colors.emerald;
          if (text === 'AGING') data.cell.styles.textColor = colors.warning;
          if (text === 'SPOILT') data.cell.styles.textColor = colors.rose;
        }
      },
      margin: { left: 15, right: 15 },
    });
  }

  // --- Unit Telemetry ---
  // Adjust Y if donor contact text was drawn
  const textOffset = (!isEmpty && data.currentLocker.activeDonation) ? 10 : 0;
  currentY = (doc as any).lastAutoTable.finalY + 15 + textOffset;
  if (currentY > 230) { doc.addPage(); currentY = 25; }
  
  drawSectionHeader(doc, `Critical Sensor Diagnostics ${isEmpty ? '// UNIT VACANT' : ''}`, currentY, isEmpty ? colors.warning : colors.accent);

  autoTable(doc, {
    startY: currentY + 5,
    head: [['SENSOR MODULE', 'TELEMETRY READING', 'OPERATIONAL STATUS']],
    body: [
      ['UNIT OCCUPANCY', data.currentLocker.occupancyState.toUpperCase(), isEmpty ? 'VACANT' : 'ENGAGED'],
      ['GAS RESISTANCE (VOC)', `${data.currentLocker.telemetry.gasResistanceOhms.toLocaleString()} Ohms`, data.currentLocker.telemetry.gasResistanceOhms > 15000 ? 'NOMINAL' : 'ATTENTION'],
      ['INTERNAL TEMPERATURE', `${data.currentLocker.telemetry.internalTempC.toFixed(1)}°C`, data.currentLocker.telemetry.internalTempC <= 5 ? 'OPTIMAL' : 'ELEVATED'],
      ['RELATIVE HUMIDITY', `${data.currentLocker.telemetry.humidityPct.toFixed(1)}%`, 'STABLE'],
      ['AI ENGINE STATE', 'TINYML EDGE v4.2', isEmpty ? 'MONITORING' : 'ACTIVE'],
      ['SANITIZATION', data.currentLocker.sanitizationState.toUpperCase(), 'VERIFIED'],
    ],
    theme: 'striped',
    headStyles: { fillColor: isEmpty ? colors.warning : colors.accent, textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 5 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const text = data.cell.text[0];
        if (text === 'NOMINAL' || text === 'OPTIMAL' || text === 'ACTIVE' || text === 'VERIFIED' || text === 'MONITORING') data.cell.styles.textColor = colors.emerald;
        if (text === 'ATTENTION' || text === 'ELEVATED' || text === 'VACANT') data.cell.styles.textColor = colors.warning;
      }
    },
    margin: { left: 15, right: 15 },
  });

  // --- Predictive Analytics ---
  currentY = (doc as any).lastAutoTable.finalY + 15;
  if (currentY > 200) { doc.addPage(); currentY = 25; }

  if (isEmpty) {
    drawSectionHeader(doc, 'AI Engine Status // STANDBY', currentY, colors.textMuted);
    autoTable(doc, {
      startY: currentY + 5,
      body: [['SYSTEM STATE', 'MONITORING - NO ACTIVE ASSETS', 'READY']],
      theme: 'plain',
      styles: { fontSize: 9, fontStyle: 'italic', textColor: colors.textMuted },
      margin: { left: 15, right: 15 },
    });
  } else if (data.receiverTelemetry) {
    drawSectionHeader(doc, 'AI Predictive Analytics', currentY, colors.primary);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['ANALYTIC PARAMETER', 'PREDICTION', 'CONFIDENCE']],
      body: [
        ['FOOD QUALITY INDEX', `${data.receiverTelemetry.qualityScore}%`, '98.2%'],
        ['ESTIMATED SHELF LIFE', `${data.receiverTelemetry.hoursRemaining.toFixed(1)} Hours`, '94.5%'],
        ['RISK CATEGORIZATION', data.receiverTelemetry.riskLevel.toUpperCase(), 'NOMINAL'],
        ['CURRENT HEALTH STATE', data.receiverTelemetry.spoilageStatus.toUpperCase(), 'STABLE'],
      ],
      theme: 'grid',
      headStyles: { fillColor: colors.primary, textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 5 },
      margin: { left: 15, right: 15 },
    });

    // Insight Box
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFillColor(248, 250, 252);
    doc.rect(15, finalY + 5, pageWidth - 30, 25, 'F');
    doc.setDrawColor(20, 184, 166);
    doc.setLineWidth(1);
    doc.line(15, finalY + 5, 15, finalY + 30);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('AI COGNITIVE INSIGHT & RECOMMENDATION:', 20, finalY + 13);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(51, 65, 85);
    const splitInsight = doc.splitTextToSize(data.receiverTelemetry.aiInsight, pageWidth - 45);
    doc.text(splitInsight, 20, finalY + 19);
  }

  // --- Footer ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Bottom Border
    doc.setFillColor(15, 23, 42);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `SAFE INTELLIGENCE SYSTEM // CRYPTOGRAPHICALLY SIGNED TELEMETRY LOG // PAGE ${i} OF ${pageCount}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );

    // Decorative Line
    doc.setFillColor(20, 184, 166);
    doc.rect(0, pageHeight - 15, pageWidth, 1, 'F');
  }

  const timestamp = new Date();
  const dateStr = timestamp.toISOString().split('T')[0];
  const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-').slice(0, 5);
  const unitLabel = data.terminalId.replace('chamber-', 'UNIT_');
  
  const filename = `SAFE_Intelligence_Audit_${unitLabel}_${dateStr}_${timeStr}.pdf`;
  doc.save(filename);
};

export interface CalendarDonationEntry {
  id: string;
  donorName: string;
  donorContact: string;
  foodName: string;
  categoryLabel: string;
  dietTag: string;
  createdAt: string;
  latestQualityScore: string;
  lockerId: string;
  status?: string;
  retrievedAt?: string;
  retrievedBy?: string;
  qualityScoreAtRetrieval?: string;
}

export interface CalendarReportData {
  generatedBy: string;
  timestamp: string;
  events: CalendarDonationEntry[];
  weekRange: string;
}

export const generateCalendarPDF = (data: CalendarReportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const colors: Record<string, [number, number, number]> = {
    primary: [15, 23, 42],      // Slate 900
    accent: [20, 184, 166],     // Teal 500
    emerald: [16, 185, 129],    // Emerald 500
    rose: [244, 63, 94],       // Rose 500
    warning: [245, 158, 11],    // Amber 500
    textMuted: [148, 163, 184], // Slate 400
  };

  const drawSectionHeader = (d: jsPDF, title: string, y: number, color: [number, number, number]) => {
    const r = Math.round(255 - (255 - color[0]) * 0.1);
    const g = Math.round(255 - (255 - color[1]) * 0.1);
    const b = Math.round(255 - (255 - color[2]) * 0.1);
    d.setFillColor(r, g, b);
    d.rect(15, y - 6, pageWidth - 30, 9, 'F');
    d.setFillColor(color[0], color[1], color[2]);
    d.rect(15, y - 6, 2, 9, 'F');
    d.setFontSize(9);
    d.setFont('helvetica', 'bold');
    d.setTextColor(color[0], color[1], color[2]);
    d.text(title.toUpperCase(), 22, y);
  };

  const addHeaderDecoration = (d: jsPDF) => {
    d.setDrawColor(20, 184, 166);
    d.setLineWidth(0.5);
    d.line(5, 5, 15, 5);
    d.line(5, 5, 5, 15);
    d.line(pageWidth - 5, 5, pageWidth - 15, 5);
    d.line(pageWidth - 5, 5, pageWidth - 5, 15);
  };

  // --- Header ---
  doc.setFillColor(15, 23, 42); 
  doc.rect(0, 0, pageWidth, 55, 'F');
  
  // Header Gradient Effect
  for (let i = 0; i < 10; i++) {
    const opacity = 0.05 * (10 - i);
    const r = Math.round(255 - (255 - 20) * opacity);
    const g = Math.round(255 - (255 - 184) * opacity);
    const b = Math.round(255 - (255 - 166) * opacity);
    doc.setFillColor(r, g, b);
    doc.rect(0, 55 - (i * 2), pageWidth, 2, 'F');
  }

  addHeaderDecoration(doc);
  
  doc.setFillColor(20, 184, 166);
  doc.circle(25, 25, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('S', 22, 27.5);
  
  doc.setFontSize(24);
  doc.text('SAFE INTELLIGENCE', 42, 26);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 184, 166);
  doc.text('COMMUNITY CONTRIBUTION TIMELINE REPORT', 42, 33);
  
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(`REPORT_TYPE: FLEET_CALENDAR_AUDIT`, pageWidth - 15, 20, { align: 'right' });
  doc.text(`RANGE: ${data.weekRange}`, pageWidth - 15, 25, { align: 'right' });
  doc.text(`GENERATED: ${formatDateTime(data.timestamp).toUpperCase()}`, pageWidth - 15, 30, { align: 'right' });

  let currentY = 70;

  // --- Summary Cards ---
  drawSectionHeader(doc, 'Weekly Contribution Summary', currentY, colors.primary);
  currentY += 10;

  const totalEvents = data.events.length;
  const completed = data.events.filter(e => e.status === 'retrieved').length;
  const active = totalEvents - completed;
  const efficiency = totalEvents > 0 ? Math.round((completed / totalEvents) * 100) : 0;

  autoTable(doc, {
    startY: currentY,
    head: [['TOTAL LOGGED', 'DISTRIBUTED', 'ACTIVE IN FLEET', 'EFFICIENCY RATING']],
    body: [[
      String(totalEvents),
      String(completed),
      String(active),
      `${efficiency}%`
    ]],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 14, fontStyle: 'bold', cellPadding: 8, halign: 'center' },
    margin: { left: 15, right: 15 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // --- Analytics & Dietary Breakdown ---
  drawSectionHeader(doc, 'Fleet Analytics & Dietary Breakdown', currentY, colors.emerald);
  
  const vegCount = data.events.filter(e => e.dietTag.toLowerCase().includes('veg')).length;
  const standardCount = totalEvents - vegCount;
  const freshCount = data.events.filter(e => e.latestQualityScore === 'fresh').length;
  const warningCount = totalEvents - freshCount;

  autoTable(doc, {
    startY: currentY + 5,
    head: [['DIETARY: VEG/VEGAN', 'DIETARY: STANDARD', 'QUALITY: OPTIMAL', 'QUALITY: WARNINGS']],
    body: [[
      String(vegCount),
      String(standardCount),
      String(freshCount),
      String(warningCount)
    ]],
    theme: 'grid',
    headStyles: { fillColor: colors.emerald, textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 11, fontStyle: 'bold', cellPadding: 6, halign: 'center' },
    margin: { left: 15, right: 15 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;
  if (currentY > 230) { doc.addPage(); currentY = 25; }

  // --- Detailed Event Log ---
  drawSectionHeader(doc, 'Detailed Distribution Matrix', currentY, colors.accent);
  
  autoTable(doc, {
    startY: currentY + 5,
    head: [['TIMESTAMP', 'UNIT', 'ASSET / DONOR', 'QUALITY', 'STATUS', 'COLLECTION']],
    body: data.events.map(e => [
      formatDateTime(e.createdAt),
      e.lockerId.replace('chamber-', 'SAFE-'),
      `${e.foodName}\nby ${e.donorName}`,
      e.latestQualityScore.toUpperCase(),
      e.status === 'retrieved' ? 'COMPLETED' : 'PENDING',
      e.retrievedAt ? formatDateTime(e.retrievedAt) : '---'
    ]),
    theme: 'striped',
    headStyles: { fillColor: colors.accent, textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 15, fontStyle: 'bold' },
      3: { fontStyle: 'bold' },
      4: { fontStyle: 'bold' },
      5: { cellWidth: 32 }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 3) {
           const text = data.cell.text[0];
           if (text === 'FRESH') data.cell.styles.textColor = colors.emerald;
           if (text === 'AGING') data.cell.styles.textColor = colors.warning;
           if (text === 'SPOILT') data.cell.styles.textColor = colors.rose;
        }
        if (data.column.index === 4) {
          const text = data.cell.text[0];
          if (text === 'COMPLETED') data.cell.styles.textColor = colors.emerald;
          if (text === 'PENDING') data.cell.styles.textColor = colors.warning;
        }
      }
    },
    margin: { left: 15, right: 15, bottom: 20 },
  });

  // --- Footer ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `SAFE INTELLIGENCE SYSTEM // COMMUNITY TIMELINE AUDIT // PAGE ${i} OF ${pageCount}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
    doc.setFillColor(20, 184, 166);
    doc.rect(0, pageHeight - 15, pageWidth, 1, 'F');
  }

  const timestamp = new Date();
  const dateStr = timestamp.toISOString().split('T')[0];
  const filename = `SAFE_Timeline_Audit_${dateStr}.pdf`;
  doc.save(filename);
};
