export interface ParsedTaskItem {
  status: string;
  title: string;
  category?: string;
  minutes?: number;
}

export interface ParsedReport {
  totalTimeStr: string;
  sessionCountStr: string;
  selfScore?: number;
  tasks: ParsedTaskItem[];
  noTasks: boolean;
  learnings: string;
  challenges: string;
  nextActions: string;
}

/**
 * Parses markdown daily report body into structured components
 */
export function parseReportBody(body: string): ParsedReport {
  // Extract total time
  const timeMatch = body.match(/総集中時間\*\*:\s*([^\n\r]+)/);
  const totalTimeStr = timeMatch ? timeMatch[1].trim() : '0分 (0.0 pomo)';

  // Extract session count
  const sessionMatch = body.match(/消化セッション\*\*:\s*([^\n\r]+)/);
  const sessionCountStr = sessionMatch ? sessionMatch[1].trim() : '0 回';

  // Extract self score
  const scoreMatch = body.match(/本日の達成度\s*(?:\/|\s)\s*やる気度\*\*:\s*(\d+)点/);
  const selfScore = scoreMatch ? Number(scoreMatch[1]) : undefined;

  // Extract tasks section
  const tasksSectionMatch = body.match(/### [^\n]*完了・進行したタスク[\r\n]+([\s\S]*?)(?=\n## |$)/);
  const tasksSection = tasksSectionMatch ? tasksSectionMatch[1].trim() : '';
  const noTasks = !tasksSection || tasksSection.includes('記録されたタスク活動はありません');
  const tasks: ParsedTaskItem[] = [];

  if (!noTasks) {
    const taskLines = tasksSection.split('\n');
    for (const line of taskLines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('-')) continue;

      // Match "- [STATUS] **Title** (Category > Topic) - X分集中"
      const detailedMatch = trimmed.match(/- \[([^\]]*)\] \*\*(.*?)\*\*(?: \((.*?)\))?(?: - (\d+)分集中)?/);
      if (detailedMatch) {
        tasks.push({
          status: detailedMatch[1] || 'TODO',
          title: detailedMatch[2],
          category: detailedMatch[3],
          minutes: detailedMatch[4] ? Number(detailedMatch[4]) : undefined,
        });
      } else {
        const simpleTitle = trimmed.replace(/^-\s*/, '').replace(/\*\*/g, '');
        if (simpleTitle && !simpleTitle.includes('記録されたタスク活動はありません')) {
          tasks.push({ status: 'TODO', title: simpleTitle });
        }
      }
    }
  }

  // Helper to extract clean content of a section
  const extractSection = (headingRegex: RegExp): string => {
    const match = body.match(headingRegex);
    if (!match) return '';
    let content = match[1].trim();
    // If it's just a bullet with nothing "- " or "-", treat as empty
    if (content === '-' || content === '- ' || content === '・') return '';
    return content;
  };

  const learnings = extractSection(/## [^\n]*今日学んだこと・気づき[^\n]*[\r\n]+([\s\S]*?)(?=\n## |$)/);
  const challenges = extractSection(/## [^\n]*課題・反省点[^\n]*[\r\n]+([\s\S]*?)(?=\n## |$)/);
  const nextActions = extractSection(/## [^\n]*明日のアクション[^\n]*[\r\n]+([\s\S]*?)(?=\n## |$)/);

  return {
    totalTimeStr,
    sessionCountStr,
    selfScore,
    tasks,
    noTasks: noTasks || tasks.length === 0,
    learnings,
    challenges,
    nextActions,
  };
}

/**
 * Builds the exact markdown daily report specified by user
 */
export function buildReportMarkdown(params: {
  totalMin: number;
  totalSec: number;
  pomoEquivalent: number;
  sessionCount: number;
  selfScore?: number;
  tasks: Array<{ status: string; title: string; category?: string; topic?: string; actualFocusSec?: number }>;
  learnings: string;
  challenges: string;
  nextActions: string;
}): string {
  const { totalMin, totalSec, pomoEquivalent, sessionCount, selfScore, tasks, learnings, challenges, nextActions } = params;

  let facts = `## **本日の集中実績** (Facts)\n`;
  facts += `- **総集中時間**: ${totalMin}分 (${pomoEquivalent.toFixed(1)} pomo)\n`;
  facts += `- **消化セッション**: ${sessionCount} 回\n`;
  if (selfScore !== undefined && selfScore !== null) {
    facts += `- **本日の達成度 / やる気度**: ${selfScore}点 / 100点\n`;
  }
  facts += `\n### 完了・進行したタスク\n`;

  const activeTasks = tasks.filter((t) => t.status === 'COMPLETED' || (t.actualFocusSec || 0) > 0);
  if (activeTasks.length > 0) {
    for (const t of activeTasks) {
      const m = Math.floor((t.actualFocusSec || 0) / 60);
      const cat = t.category || '未分類';
      const top = t.topic ? ` > ${t.topic}` : '';
      facts += `- [${t.status}] **${t.title}** (${cat}${top}) - ${m}分集中\n`;
    }
  } else {
    facts += `- (記録されたタスク活動はありません)\n`;
  }

  const formatSection = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return '- \n';
    return trimmed
      .split('\n')
      .map((line) => {
        const l = line.trim();
        if (!l) return '';
        if (l.startsWith('-') || l.startsWith('・') || l.startsWith('*')) return l;
        return `- ${l}`;
      })
      .filter(Boolean)
      .join('\n') + '\n';
  };

  return `${facts}
## **今日学んだこと・気づき**
${formatSection(learnings)}
## **課題・反省点**
${formatSection(challenges)}
## **明日のアクション**
${formatSection(nextActions)}
`;
}
