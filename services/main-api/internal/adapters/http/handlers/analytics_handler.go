package handlers

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"github.com/gofiber/fiber/v2"
	"github.com/jung-kurt/gofpdf"
	"github.com/salesai/main-api/internal/core/usecases/analytics"
	"github.com/xuri/excelize/v2"
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
	companyID := c.Locals("company_id").(string)

	filters := map[string]interface{}{
		"period":  c.Query("period"),
		"team_id": c.Query("team_id"),
	}

	result, err := h.teamPerformanceUC.Execute(c.Context(), companyID, filters)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"period":   filters["period"],
		"managers": result,
	})
}

func (h *AnalyticsHandler) GetLeaderboard(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(string)

	filters := map[string]interface{}{
		"team_id": c.Query("team_id"),
	}

	result, err := h.teamPerformanceUC.Execute(c.Context(), companyID, filters)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

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
	writer.Write([]string{"Rank", "Manager", "Total Calls", "Avg Quality", "Avg Script Match", "Avg Errors Free", "Overall KPI", "Total Duration (min)"})

	for i, m := range data {
		writer.Write([]string{
			fmt.Sprintf("%d", i+1),
			fmt.Sprintf("%v", m["manager_name"]),
			fmt.Sprintf("%v", m["total_calls"]),
			fmt.Sprintf("%.2f", m["avg_quality"]),
			fmt.Sprintf("%.2f", m["avg_script_match"]),
			fmt.Sprintf("%.2f", m["avg_errors_free"]),
			fmt.Sprintf("%.2f", m["avg_kpi"]),
			fmt.Sprintf("%.2f", m["total_duration_minutes"]),
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

	headers := []string{"Rank", "Manager", "Total Calls", "Avg Quality", "Avg Script Match", "Avg Errors Free", "Overall KPI", "Total Duration (min)"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	for i, m := range data {
		f.SetCellValue(sheet, fmt.Sprintf("A%d", i+2), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", i+2), m["manager_name"])
		f.SetCellValue(sheet, fmt.Sprintf("C%d", i+2), m["total_calls"])
		f.SetCellValue(sheet, fmt.Sprintf("D%d", i+2), m["avg_quality"])
		f.SetCellValue(sheet, fmt.Sprintf("E%d", i+2), m["avg_script_match"])
		f.SetCellValue(sheet, fmt.Sprintf("F%d", i+2), m["avg_errors_free"])
		f.SetCellValue(sheet, fmt.Sprintf("G%d", i+2), m["avg_kpi"])
		f.SetCellValue(sheet, fmt.Sprintf("H%d", i+2), m["total_duration_minutes"])
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
	pdf := gofpdf.New("L", "mm", "A4", "") // Landscape for more columns
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, "Sales Leaderboard")
	pdf.Ln(12)

	pdf.SetFont("Arial", "B", 10)
	headers := []string{"Rank", "Manager", "Calls", "Qual", "Script", "ErrFree", "KPI", "Dur(m)"}
	widths := []float64{15, 60, 20, 30, 30, 30, 30, 30}

	for i, head := range headers {
		pdf.CellFormat(widths[i], 10, head, "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 10)
	for i, m := range data {
		pdf.CellFormat(widths[0], 10, fmt.Sprintf("%d", i+1), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[1], 10, fmt.Sprintf("%v", m["manager_name"]), "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[2], 10, fmt.Sprintf("%v", m["total_calls"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[3], 10, fmt.Sprintf("%.1f", m["avg_quality"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[4], 10, fmt.Sprintf("%.1f", m["avg_script_match"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[5], 10, fmt.Sprintf("%.1f", m["avg_errors_free"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[6], 10, fmt.Sprintf("%.2f", m["avg_kpi"]), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[7], 10, fmt.Sprintf("%.1f", m["total_duration_minutes"]), "1", 0, "C", false, 0, "")
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
