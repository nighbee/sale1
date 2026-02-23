package handlers

import (
	"bytes"
	"encoding/csv"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/jung-kurt/gofpdf"
	"github.com/salesai/main-api/internal/core/usecases/analytics"
	applogger "github.com/salesai/main-api/internal/infrastructure/logger"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
)

type AnalyticsHandler struct {
	teamPerformanceUC *analytics.TeamPerformanceUseCase
}

func NewAnalyticsHandler(teamPerformanceUC *analytics.TeamPerformanceUseCase) *AnalyticsHandler {
	return &AnalyticsHandler{
		teamPerformanceUC: teamPerformanceUC,
	}
}

func (h *AnalyticsHandler) GetTeamPerformance(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "team_performance"))

	filters := map[string]interface{}{
		"period":          c.Query("period"),
		"team_id":         c.Query("team_id"),
		"include_pending": c.Query("include_pending") == "true",
	}

	log.Debug("fetching team performance", zap.Any("filters", filters))
	result, err := h.teamPerformanceUC.Execute(c.Context(), "", filters)
	if err != nil {
		log.Error("team performance query failed", zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	log.Info("team performance fetched", zap.Int("manager_count", len(result)))
	return c.JSON(fiber.Map{
		"period":   filters["period"],
		"managers": result,
	})
}

func (h *AnalyticsHandler) GetLeaderboard(c *fiber.Ctx) error {
	log := applogger.FromFiberCtx(c).With(zap.String("operation", "get_leaderboard"))
	companyID := c.Locals("company_id").(string)
	if c.Locals("role").(string) == "super_admin" {
		if qCID := c.Query("company_id"); qCID != "" {
			companyID = qCID
		} else {
			companyID = ""
		}
	}

	filters := map[string]interface{}{
		"team_id":    c.Query("team_id"),
		"period":     c.Query("period"),
		"source":     c.Query("source"),
		"sort_by":    c.Query("sort_by"),
		"manager_id": c.Query("manager_id"),
	}

	log.Debug("fetching leaderboard", zap.String("company_id", companyID), zap.Any("filters", filters))
	result, err := h.teamPerformanceUC.Execute(c.Context(), companyID, filters)
	if err != nil {
		log.Error("leaderboard query failed", zap.String("company_id", companyID), zap.Error(err))
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	log.Info("leaderboard fetched", zap.String("company_id", companyID), zap.Int("entries", len(result)))
	return c.JSON(fiber.Map{
		"leaderboard": result,
	})
}

// ExportLeaderboard godoc
// @Summary Export leaderboard data
// @Description Export leaderboard performance data in CSV, Excel, or PDF format
// @Tags analytics
// @Produce octet-stream
// @Param format path string true "Export format (csv, excel, pdf)"
// @Param team_id query string false "Filter by team ID"
// @Success 200 {file} binary
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Security BearerAuth
// @Router /analytics/leaderboard/export/{format} [get]
func (h *AnalyticsHandler) ExportLeaderboard(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)
	if c.Locals("role").(string) == "super_admin" {
		if qCID := c.Query("company_id"); qCID != "" {
			companyID = qCID
		} else {
			companyID = ""
		}
	}
	format := c.Params("format")
	filters := map[string]interface{}{
		"team_id": c.Query("team_id"),
	}

	result, err := h.teamPerformanceUC.Execute(c.Context(), companyID, filters)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	switch format {
	case "csv":
		return h.exportCSV(c, result)
	case "excel":
		return h.exportExcel(c, result)
	case "pdf":
		return h.exportPDF(c, result)
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Unsupported format"})
	}
}

func (h *AnalyticsHandler) exportCSV(c *fiber.Ctx, data []map[string]interface{}) error {
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", "attachment; filename=leaderboard.csv")

	writer := csv.NewWriter(c.Response().BodyWriter())
	writer.Write([]string{"Rank", "Manager", "Total Calls", "Excellent", "Avg Dur", "Total Dur", "Avg Quality", "Avg Script Match", "Overall KPI"})

	for i, m := range data {
		writer.Write([]string{
			fmt.Sprintf("%d", i+1),
			fmt.Sprintf("%v", m["manager_name"]),
			fmt.Sprintf("%v", m["total_calls"]),
			fmt.Sprintf("%v", m["excellent_calls_count"]),
			fmt.Sprintf("%.1fm", m["avg_duration_minutes"]),
			fmt.Sprintf("%.1fm", m["total_duration_minutes"]),
			fmt.Sprintf("%.2f", m["avg_quality"]),
			fmt.Sprintf("%.2f", m["avg_script_match"]),
			fmt.Sprintf("%.2f", m["avg_kpi"]),
		})
	}
	writer.Flush()
	return nil
}

func (h *AnalyticsHandler) exportExcel(c *fiber.Ctx, data []map[string]interface{}) error {
	f := excelize.NewFile()
	sheet := "Leaderboard"
	f.NewSheet(sheet)
	f.DeleteSheet("Sheet1")

	headers := []string{"Rank", "Manager", "Total Calls", "Excellent", "Avg Dur", "Total Dur", "Avg Quality", "Avg Script Match", "Overall KPI"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	for i, m := range data {
		f.SetCellValue(sheet, fmt.Sprintf("A%d", i+2), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", i+2), m["manager_name"])
		f.SetCellValue(sheet, fmt.Sprintf("C%d", i+2), m["total_calls"])
		f.SetCellValue(sheet, fmt.Sprintf("D%d", i+2), m["excellent_calls_count"])
		f.SetCellValue(sheet, fmt.Sprintf("E%d", i+2), m["avg_duration_minutes"])
		f.SetCellValue(sheet, fmt.Sprintf("F%d", i+2), m["total_duration_minutes"])
		f.SetCellValue(sheet, fmt.Sprintf("G%d", i+2), m["avg_quality"])
		f.SetCellValue(sheet, fmt.Sprintf("H%d", i+2), m["avg_script_match"])
		f.SetCellValue(sheet, fmt.Sprintf("I%d", i+2), m["avg_kpi"])
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate Excel"})
	}

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=leaderboard.xlsx")
	return c.Send(buf.Bytes())
}

func (h *AnalyticsHandler) exportPDF(c *fiber.Ctx, data []map[string]interface{}) error {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, "Sales Leaderboard")
	pdf.Ln(12)

	pdf.SetFont("Arial", "B", 8)
	headers := []string{"Rank", "Manager", "Calls", "Exc", "AvgDur", "TotDur", "Qual", "Script", "KPI"}
	widths := []float64{10, 45, 15, 15, 20, 20, 20, 20, 20}

	for i, head := range headers {
		pdf.CellFormat(widths[i], 10, head, "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 8)
	for i, m := range data {
		pdf.CellFormat(widths[0], 10, fmt.Sprintf("%d", i+1), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[1], 10, fmt.Sprintf("%v", m["manager_name"]), "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[2], 10, fmt.Sprintf("%v", m["total_calls"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[3], 10, fmt.Sprintf("%v", m["excellent_calls_count"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[4], 10, fmt.Sprintf("%.1fm", m["avg_duration_minutes"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[5], 10, fmt.Sprintf("%.1fm", m["total_duration_minutes"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[6], 10, fmt.Sprintf("%.1f", m["avg_quality"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[7], 10, fmt.Sprintf("%.1f", m["avg_script_match"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[8], 10, fmt.Sprintf("%.2f", m["avg_kpi"]), "1", 0, "C", false, 0, "")
		pdf.Ln(-1)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate PDF"})
	}

	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", "attachment; filename=leaderboard.pdf")
	return c.Send(buf.Bytes())
}
