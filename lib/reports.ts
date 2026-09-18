import { type StudyData, download, localDay } from "./data";
import { weightedGrade, mean } from "./analytics";
export async function exportReport(
  data: StudyData,
  course: string,
  days: number,
  format: "pdf" | "docx",
) {
  const end = new Date(),
    start = new Date();
  start.setDate(start.getDate() - days);
  const sessions = data.sessions.filter(
    (s) =>
      (course === "all" || s.courseId === course) &&
      new Date(s.date) >= start &&
      new Date(s.date) <= end,
  );
  const lines = [
    "STUDY ANALYZER",
    "Your progress, in perspective",
    `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`,
    `${sessions.length} sessions | ${(sessions.reduce((a, s) => a + s.duration, 0) / 60).toFixed(1)} hours | Average rating: ${sessions.length ? mean(sessions.map((s) => s.rating)).toFixed(1) : "N/A"}/5`,
    "",
    ...data.courses
      .filter((c) => course === "all" || c.id === course)
      .flatMap((c) => {
        const s = sessions.filter((s) => s.courseId === c.id);
        const grade = weightedGrade(
          data.exams.filter(
            (e) =>
              e.courseId === c.id && e.date <= end.toLocaleDateString("en-CA"),
          ),
        );
        return [
          c.name,
          `${s.length} sessions, ${(s.reduce((a, x) => a + x.duration, 0) / 60).toFixed(1)} hours. Cumulative recorded grade: ${grade === null ? "N/A" : grade.toFixed(1) + "%"}`,
          ...[...new Set(s.map((x) => x.type))].map(
            (t) =>
              `  ${t}: ${s.filter((x) => x.type === t).reduce((a, x) => a + x.duration, 0)} minutes`,
          ),
          "",
        ];
      }),
    "SESSION LOG",
    ...sessions
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(
        (s) =>
          `${localDay(s)} | ${data.courses.find((c) => c.id === s.courseId)?.name} | ${s.type} | ${s.duration} min | ${s.rating}/5`,
      ),
    "",
    "Ratings are self-reported. This report describes recorded activity, not causal learning outcomes.",
  ];
  if (format === "docx") {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      sections: [
        {
          children: lines.map(
            (line, i) =>
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: line,
                    bold: i < 2,
                    size: i === 0 ? 38 : 22,
                    font: "Calibri",
                  }),
                ],
              }),
          ),
        },
      ],
    });
    download(await Packer.toBlob(doc), "study-report.docx");
  } else {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    let y = 20;
    for (const [i, line] of lines.entries()) {
      pdf.setFontSize(i === 0 ? 20 : 10);
      const wrapped = pdf.splitTextToSize(line, 170) as string[];
      for (const text of wrapped) {
        if (y > 275) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(text, 20, y);
        y += 6;
      }
      y += 2;
    }
    pdf.save("study-report.pdf");
  }
}
