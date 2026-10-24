package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ryo09020/ketchup-desktop/server/internal/models"
)

type GeminiClient struct {
	apiKey     string
	httpClient *http.Client
}

func NewGeminiClient(apiKey string) *GeminiClient {
	if apiKey == "" {
		apiKey = os.Getenv("GEMINI_API_KEY")
	}
	return &GeminiClient{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

type geminiPart struct {
	Text       string      `json:"text,omitempty"`
	InlineData *inlineData `json:"inlineData,omitempty"`
}

type inlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"` // base64
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (c *GeminiClient) VoiceToReport(ctx context.Context, req models.VoiceToReportRequest) (*models.VoiceToReportResponse, error) {
	if c.apiKey == "" {
		// Fallback for development without API key
		return &models.VoiceToReportResponse{
			Transcript: "今日は集中してポモドーロタスクを複数消化しました。",
			DraftBody: fmt.Sprintf(`## **本日の集中実績** (Facts)
- 集中セッション実施 (%s)

## **今日学んだこと・気づき**
- 短いターム設定を取り入れたことで集中への着手が非常にスムーズになった。

## **課題・反省点**
- 作業の途中で別の調べ物に脱線しそうになった。

## **明日のアクション**
- 朝一番のタームで最優先タスクを片付ける。`, req.Date),
		}, nil
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=%s", c.apiKey)
	prompt := `添付の音声は、集中タスク管理アプリ「KetchUp」のユーザーが話した本日の作業記録・感想です。
1. まず話された内容を日本語で正確に文字起こししてください (Transcript)。
2. その内容を以下の日報テンプレートに整形してください (DraftBody)。
日報テンプレート:
## **今日学んだこと・気づき**
- 成果や学び

## **課題・反省点**
- 反省やボトルネック

## **明日のアクション**
- 次の課題

出力は JSON 形式で以下のように返してください:
{"transcript": "文字起こし全文", "draftBody": "整形されたMarkdown本文"}
`

	bodyReq := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: prompt},
					{
						InlineData: &inlineData{
							MimeType: req.MimeType,
							Data:     req.AudioBase64,
						},
					},
				},
			},
		},
	}

	jsonData, err := json.Marshal(bodyReq)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	resBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	var gRes geminiResponse
	if err := json.Unmarshal(resBytes, &gRes); err != nil {
		return nil, err
	}

	if len(gRes.Candidates) == 0 || len(gRes.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from gemini")
	}

	text := gRes.Candidates[0].Content.Parts[0].Text
	var result models.VoiceToReportResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil {
		return &models.VoiceToReportResponse{
			Transcript: "音声入力を処理しました",
			DraftBody:  text,
		}, nil
	}

	return &result, nil
}

// ClassifyTask classifies a task into a broad Category (大グループ) and Topic (小グループ)
func (c *GeminiClient) ClassifyTask(ctx context.Context, title string) (*models.AIClassifyTaskResponse, error) {
	// Fast rule-based heuristic fallback if API key is not set or quick classification
	lower := strings.ToLower(title)
	defaultCat := "一般タスク"
	defaultTop := "タスク"

	if strings.Contains(lower, "英語") || strings.Contains(lower, "単語") || strings.Contains(lower, "toeic") || strings.Contains(lower, "文法") || strings.Contains(lower, "リスニング") || strings.Contains(lower, "duo") || strings.Contains(lower, "ターゲット") {
		defaultCat = "英語学習"
		if strings.Contains(lower, "単語") || strings.Contains(lower, "ターゲット") || strings.Contains(lower, "duo") {
			defaultTop = "単語暗記"
		} else if strings.Contains(lower, "過去問") || strings.Contains(lower, "問題") {
			defaultTop = "問題演習"
		} else {
			defaultTop = "文法・読解"
		}
	} else if strings.Contains(lower, "数学") || strings.Contains(lower, "計算") || strings.Contains(lower, "チャート") || strings.Contains(lower, "微積") || strings.Contains(lower, "数i") || strings.Contains(lower, "数a") {
		defaultCat = "数学学習"
		defaultTop = "問題演習"
	} else if strings.Contains(lower, "開発") || strings.Contains(lower, "実装") || strings.Contains(lower, "バグ") || strings.Contains(lower, "修正") || strings.Contains(lower, "コード") || strings.Contains(lower, "api") || strings.Contains(lower, "ui") || strings.Contains(lower, "test") {
		defaultCat = "開発・実装"
		if strings.Contains(lower, "バグ") || strings.Contains(lower, "修正") {
			defaultTop = "デバッグ"
		} else {
			defaultTop = "機能開発"
		}
	} else if strings.Contains(lower, "読書") || strings.Contains(lower, "本") || strings.Contains(lower, "本読み") {
		defaultCat = "インプット"
		defaultTop = "読書"
	} else if strings.Contains(lower, "筋トレ") || strings.Contains(lower, "ランニング") || strings.Contains(lower, "運動") || strings.Contains(lower, "ストレッチ") {
		defaultCat = "ヘルスケア"
		defaultTop = "運動"
	}

	if c.apiKey == "" {
		return &models.AIClassifyTaskResponse{
			Category: defaultCat,
			Topic:    defaultTop,
		}, nil
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", c.apiKey)
	prompt := fmt.Sprintf(`タスクタイトル「%s」を分析し、
1. 大グループ (Category: 例「英語学習」「数学」「開発・プログラミング」「読書・教養」「日常業務」など)
2. 小グループ (Topic: 例「単語暗記」「過去問演習」「デバッグ」「UI実装」など)
の2階層にクラスタリングしてください。

出力は必ず以下のJSON形式のみ返してください:
{"category": "大グループ名", "topic": "小グループ名"}`, title)

	bodyReq := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
	}
	jsonData, _ := json.Marshal(bodyReq)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return &models.AIClassifyTaskResponse{Category: defaultCat, Topic: defaultTop}, nil
	}
	httpReq.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(httpReq)
	if err != nil {
		return &models.AIClassifyTaskResponse{Category: defaultCat, Topic: defaultTop}, nil
	}
	defer res.Body.Close()

	var gRes geminiResponse
	if err := json.NewDecoder(res.Body).Decode(&gRes); err != nil || len(gRes.Candidates) == 0 {
		return &models.AIClassifyTaskResponse{Category: defaultCat, Topic: defaultTop}, nil
	}

	text := gRes.Candidates[0].Content.Parts[0].Text
	var result models.AIClassifyTaskResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil {
		return &models.AIClassifyTaskResponse{Category: defaultCat, Topic: defaultTop}, nil
	}
	if result.Category == "" {
		result.Category = defaultCat
	}
	if result.Topic == "" {
		result.Topic = defaultTop
	}
	return &result, nil
}

func (c *GeminiClient) GenerateSummary(ctx context.Context, scope, periodStart, periodEnd string, reports []models.Report, pomos []models.Pomo) (*models.AISummaryResponse, error) {
	totalSec := 0
	for _, p := range pomos {
		totalSec += p.DurationSec
	}
	totalMin := totalSec / 60
	pomoEquivalent := float64(totalSec) / 1500.0 // 25 min = 1 pomo

	if c.apiKey == "" {
		return &models.AISummaryResponse{
			Scope:       scope,
			PeriodStart: periodStart,
			PeriodEnd:   periodEnd,
			Content: fmt.Sprintf(`### %s の振り返りサマリー (%s 〜 %s)

- **実集中時間**: %d 分 (%d 秒)
- **ポモドーロ換算**: 約 %.1f pomo (1 pomo = 累積25分集中)
- **消化ターム数**: %d 回
- **日報記録**: %d 件

#### 総括 & アドバイス
短時間タームや柔軟な集中設定を効果的に活用できています。作業途中で切り上げても正確な作業秒数が積み上がっており、無理のない持続可能な集中リズムが作れています！`,
				scope, periodStart, periodEnd, totalMin, totalSec, pomoEquivalent, len(pomos), len(reports)),
		}, nil
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", c.apiKey)
	prompt := fmt.Sprintf(`あなたは作業生産性コーチです。
ユーザーの %s (%s 〜 %s) の活動実績を分析し、励ましと具体的な改善提案を含んだサマリー（Markdown形式）を作成してください。
実集中時間: %d分
ポモドーロ換算: %.1f pomo (25分=1pomo)
消化セッション回数: %d
日報数: %d
日報内容:
`, scope, periodStart, periodEnd, totalMin, pomoEquivalent, len(pomos), len(reports))

	for _, r := range reports {
		prompt += fmt.Sprintf("\n--- [%s] ---\n事実: %s\n学び: %s\n課題: %s\n", r.PublishedDate, r.AutoFacts, r.Learnings, r.Challenges)
	}

	bodyReq := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
	}

	jsonData, _ := json.Marshal(bodyReq)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var gRes geminiResponse
	if err := json.NewDecoder(res.Body).Decode(&gRes); err != nil {
		return nil, err
	}

	if len(gRes.Candidates) == 0 || len(gRes.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from gemini")
	}

	return &models.AISummaryResponse{
		Scope:       scope,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
		Content:     gRes.Candidates[0].Content.Parts[0].Text,
	}, nil
}
