package pdf;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

import javax.imageio.ImageIO;

import model.Match;
import model.PersonalScore;
import model.Season;
import model.TableRow;
import model.Team;

import org.apache.pdfbox.exceptions.COSVisitorException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.edit.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.xobject.PDJpeg;
import org.apache.pdfbox.pdmodel.graphics.xobject.PDXObjectImage;

public class PDFFactory {
	private static final int MAX_TEAM_NAME_CHARS = 35;
	PDFont normal = PDType1Font.HELVETICA;
	PDFont bold = PDType1Font.HELVETICA_BOLD;
	int normalSize = 9;
	int gap = 11;

	private PDDocument document;
	private PDPage page;
	private PDPageContentStream contentStream;
	private Season season;
	private float left, right, top, bot, rightBorder;
	float x, y;
	private float max;
	private float shooterMax;
	private float positionMax;
	private float teamMax;
	private float totalMax;
	private float meanMax;
	private float valueMax;

	private PDRectangle size;
	private float winMax;
	private float looseMax;
	private float tiedMax;
	private float ringMax;
	private float pointMax;
	private float initY;

	private void calculateXBorders(ObservableList<PersonalScore> scores) {
		try {
			positionMax = 0.f;
			for (int i = 0; i < scores.size(); i++) {
				float width = normal.getStringWidth("" + i) / 1000 * normalSize;
				if (width > positionMax) {
					positionMax = width;
				}
			}
			positionMax += 10;

			teamMax = bold.getStringWidth("Mannschaft") / 1000 * normalSize;
			for (PersonalScore score : scores) {
				float teamWidth = normal.getStringWidth(cutTeamName(score
						.getTeam())) / 1000 * normalSize;
				if (teamWidth > teamMax) {
					teamMax = teamWidth;
				}
			}
			teamMax += 10;

			shooterMax = bold.getStringWidth("Schütze/inn") / 1000 * normalSize;
			for (PersonalScore score : scores) {
				float width = normal.getStringWidth(score.getShooter()) / 1000
						* normalSize;
				if (width > shooterMax) {
					shooterMax = width;
				}
			}
			shooterMax += 10;

			totalMax = bold.getStringWidth("Gesamt") / 1000 * normalSize;
			for (PersonalScore score : scores) {
				String result = String.valueOf(score.getTotal());
				result = result.endsWith(".0") || result.endsWith(",0") ? result
						.subSequence(0, result.length() - 2).toString()
						: result;
				float width = normal.getStringWidth(result) / 1000 * normalSize;
				if (width > totalMax) {
					totalMax = width;
				}
			}
			totalMax += 10;

			meanMax = bold.getStringWidth("Schnitt") / 1000 * normalSize;
			for (PersonalScore score : scores) {
				float width = normal.getStringWidth("" + score.getMean())
						/ 1000 * normalSize;
				if (width > meanMax) {
					meanMax = width;
				}
			}
			meanMax += 10;

			valueMax = 10.f;
			for (PersonalScore score : scores) {
				for (int i = 1; i <= season.getMaxWeek(); i++) {
					String result = String.valueOf(score.getScore(i));
					result = result.endsWith(".0") || result.endsWith(",0") ? result
							.subSequence(0, result.length() - 2).toString()
							: result;
					float width = normal.getStringWidth(result) / 1000
							* normalSize;
					if (width > valueMax) {
						valueMax = width;
					}
				}
			}
			valueMax += 5;

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

	private void calculateXBordersResultTable(
			ObservableList<TableRow> teamResults) {

		try {
			teamMax = bold.getStringWidth("Mannschaft") / 1000 * normalSize;
			winMax = bold.getStringWidth("Gewonnen") / 1000 * normalSize;
			looseMax = bold.getStringWidth("Verloren") / 1000 * normalSize;
			tiedMax = bold.getStringWidth("Unentschieden") / 1000 * normalSize;
			ringMax = bold.getStringWidth("Ringe") / 1000 * normalSize;
			pointMax = bold.getStringWidth("Punkte") / 1000 * normalSize;

			for (TableRow score : teamResults) {
				float teamWidth = normal.getStringWidth(cutTeamName(score
						.getTeam())) / 1000 * normalSize;
				if (teamWidth > teamMax) {
					teamMax = teamWidth;
				}
				float winWidth = normal.getStringWidth(String.valueOf(score
						.getWin())) / 1000 * normalSize;
				if (winWidth > winMax) {
					winMax = winWidth;
				}
				float looseWidth = normal.getStringWidth(String.valueOf(score
						.getLoose())) / 1000 * normalSize;
				if (looseWidth > looseMax) {
					looseMax = looseWidth;
				}
				float tiedWidth = normal.getStringWidth(String.valueOf(score
						.getTied())) / 1000 * normalSize;
				if (tiedWidth > tiedMax) {
					tiedMax = tiedWidth;
				}
				float ringWidth = normal.getStringWidth(String.valueOf(score
						.getRings())) / 1000 * normalSize;
				if (ringWidth > ringMax) {
					ringMax = ringWidth;
				}
				float pointWidth = normal.getStringWidth(String.valueOf(score
						.getPoints())) / 1000 * normalSize;
				if (pointWidth > pointMax) {
					pointMax = pointWidth;
				}
			}
			float additionalSpace = (right - (left + teamMax + winMax
					+ looseMax + tiedMax + ringMax + pointMax + 80)) / 6;
			teamMax += 10 + additionalSpace;
			winMax += 10 + additionalSpace;
			looseMax += 10 + additionalSpace;
			tiedMax += 10 + additionalSpace;
			ringMax += 10 + additionalSpace;
			pointMax += 10 + additionalSpace;
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

	private String checkLine(String pdfLine) {
		if (pdfLine.startsWith(" ")) {
			return checkLine(pdfLine.substring(1));
		} else if (pdfLine.startsWith("\n ")) {
			return checkLine(pdfLine.substring(0, 2) + pdfLine.substring(3));
		}
		return pdfLine;

	}

	private boolean checkNewPage(float check) {
		if (y - check < bot) {
			newPage();
			return true;
		}
		return false;
	}

	private String cutTeamName(String teamname) {
		return teamname.substring(0,
				Math.min(teamname.length(), MAX_TEAM_NAME_CHARS));
	}

	public void createPDF(Season season, File file,
			ObservableList<String> pagesToCreate,
			ObservableList<Integer> observableList) {
		this.season = season;
		for (ObservableList<TableRow> table : season.getTables()) {
			Collections.sort(table);
		}
		try {
			document = new PDDocument();

			ObservableList<ObservableList<Match>> matcheWeeks = FXCollections
					.observableArrayList();
			for (int i = 0; i < season.getMaxWeek(); i++) {
				matcheWeeks.add(FXCollections.observableArrayList());
			}
			for (Match match : season.getMatches()) {
				matcheWeeks.get(match.getWeek() - 1).add(match);
			}
			calculateXBordersResultTable(season.getTables().get(0));
			if (pagesToCreate.contains("Termine")) {
				drawDates(matcheWeeks);
			}
			if (pagesToCreate.contains("Gesamtergebnis")) {
				drawResultTable(season.tables.get(0));
			}
			if (pagesToCreate.contains("Einzelergebnisse")) {
				if (season.scores.get(0).size() > 0) {
					drawPersonalScoresResult(season.scores.get(0),
							"Schützenklasse");
				}
				if (season.scores.get(1).size() > 0) {
					drawPersonalScoresResult(season.scores.get(1), "Senioren");
				}
			}
			for (Integer i : observableList) {
				ObservableList<TableRow> rows = season.getTables().get(i);
				drawCompetitionWeek(rows, i, getMatches(i));
			}

			// Make sure that the content stream is closed:
			contentStream.close();

			this.contentStream.close();

			// Save the results and ensure that the document is properly closed:
			document.save(file);
			document.close();
		} catch (COSVisitorException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private boolean containsResult(List<Match> matches) {
		for (Match match : matches) {
			if (match.getHomeScore() > 0 || match.getGuestScore() > 0) {
				return true;
			}
		}
		return false;
	}

	private void drawCompetitionWeek(ObservableList<TableRow> teamResults,
			int week, List<Match> matches) {
		try {
			setNormal();
			newPage();
			drawHeader();
			calculateXBordersResultTable(teamResults);
			float additionalSpace = (right - (left + 2 * (teamMax + ringMax) + 55)) / 4;
			teamMax += additionalSpace;
			ringMax += additionalSpace;
			x = left;
			drawString("Wettkampfwoche " + week, x, y, normal, 22);
			y -= 20;
			drawString(matches.get(0).getDate() + " - "
					+ matches.get(0).getEndDate(), x, y, normal, 14);
			y -= 30;
			drawString(
					"Saison " + season.getYear() + "/"
							+ ("" + (season.getYear() + 1)).substring(2), x, y,
					normal, 14);

			drawString(season.getLabel(),
					right - normal.getStringWidth(season.getLabel()) / 1000
							* 14, y, normal, 14);

			y -= 30;

			x = left + 5;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString("Heimmannschaft", x, y, bold, normalSize);

			x += teamMax + 10;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString("Ergebnis", x, y, bold, normalSize);
			x += 25 + ringMax;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString("Gastmannschaft", x, y, bold, normalSize);
			x += teamMax + 10;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString("Ergebnis", x, y, bold, normalSize);
			x += 10 + ringMax;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			contentStream.drawLine(left, y + gap, x - 5, y + gap);

			contentStream.drawLine(left, y - gap / 2, x - 5, y - gap / 2);
			for (Match match : matches) {
				x = left + 5;
				y -= (gap + 4);
				contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);

				drawString(cutTeamName(match.getHometeam()), x, y, normal,
						normalSize);
				x += teamMax + 10;
				contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);

				drawString(String.valueOf(match.getHomeScore()), x, y, normal,
						normalSize);
				x += 25 + ringMax;
				contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);

				drawString(cutTeamName(match.getGuestteam()), x, y, normal,
						normalSize);
				x += teamMax + 10;
				contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);

				drawString(String.valueOf(match.getGuestScore()), x, y, normal,
						normalSize);
				x += 10 + ringMax;
				contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
				contentStream.drawLine(left, y - gap / 2, x - 5, y - gap / 2);
			}
			y -= 60;
			x = left;
			drawString("Tabelle nach der " + week + ". Wettkampfwoche", x, y,
					normal, 14);

			y -= 30;
			float oldY = y;
			calculateXBordersResultTable(teamResults);

			drawTableResultHeader();
			for (int i = 0; i < teamResults.size(); i++) {
				TableRow row = teamResults.get(i);
				y -= (gap + 4);
				if (checkNewPage(0)) {
					drawTableResultHeader();
					y -= (gap + 4);
				}
				drawTableResultRow(row, i + 1);

			}

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private boolean checkNewLine(float space) {
		if (x + space <= right) {
			return false;
		}

		try {
			x = left + 10;

			if (!checkNewPage((season.getTeams().size() * (gap + 2) + 2))) {
				y -= (season.getTeams().size() * (gap + 2) + 2) + 15;
			}
			contentStream.drawLine(left, y + gap, right, y + gap);
			contentStream.drawLine(left, y - gap / 2, right, y - gap / 2);
			initY = y;
			float maxName = drawTeamNames(x);
			x += maxName + 10;
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		return true;
	}

	public void drawDates(ObservableList<ObservableList<Match>> matches) {
		setNormal();
		newPage();
		drawHeader();

		x = left;
		try {

			drawString("Rundenwettkämpfe ", x, y, normal, 22);
			y -= 30;

			drawString(
					"Saison " + season.getYear() + "/"
							+ ("" + (season.getYear() + 1)).substring(2), x, y,
					normal, 14);

			drawString(season.getLabel(),
					right - normal.getStringWidth(season.getLabel()) / 1000
							* 14, y, normal, 14);

			y -= 30;
			drawString("Hinrunde",
					left + (right - left) / 2 - bold.getStringWidth("Hinrunde")
							/ 1000 * normalSize / 2, y, bold, normalSize);
			contentStream.drawLine(x, y + gap, right, y + gap);

			contentStream.drawLine(x, y - gap / 2, right, y - gap / 2);

			float max = 0;
			for (Team team : season.getTeams()) {
				float size = normal.getStringWidth(team.getName()) / 1000
						* normalSize;
				if (size > max) {
					max = size;
				}
			}
			max = Math.max(max + 5, 75);
			int nColumns = Math.min((int) ((right - left - 75) / max), matches
					.get(0).size());
			float dist = (right - left - 75) / nColumns;
			System.out.println(nColumns);
			for (int k = 0; k < matches.size(); k++) {
				ObservableList<Match> week = matches.get(k);
				checkNewPage(((week.size() / nColumns + 1) * (2 * gap + 5)));
				drawString(week.get(0).getDate(), x + 10, y - gap - 5, normal,
						normalSize);
				drawString(week.get(0).getEndDate(), x + 10, y - 2 * gap - 5,
						normal, normalSize);
				for (int i = 0; i < week.size(); i++) {
					if (i % nColumns == 0) {
						y -= (2 * gap + 5);
					}
					Match match = week.get(i);
					drawString(match.getGuestteam(), x
							+ ((i % nColumns) * dist) + 75, y, normal,
							normalSize);
					drawString(match.getHometeam(), x + ((i % nColumns) * dist)
							+ 75, y + gap, normal, normalSize);

				}

				contentStream.drawLine(x, y - gap / 2, right, y - gap / 2);

				if (k + 1 == matches.size() / 2) {
					y -= 30;
					// New Page if only one or two row or less space
					checkNewPage((gap / 2 + 2 * (2 * gap + 5)));
					drawString(
							"Rückrunde",
							left + (right - left) / 2
									- bold.getStringWidth("Rückrunde") / 1000
									* normalSize / 2, y, bold, normalSize);

					contentStream.drawLine(x, y + gap, right, y + gap);
					contentStream.drawLine(x, y - gap / 2, right, y - gap / 2);
				}

			}
			y -= gap;

			String infobox = season.getInfoBox();

			String[] lines = infobox.split("\n");

			for (int i = 0; i < lines.length; i++) {
				String line = lines[i];
				String[] words = line.split(" ");
				String pdfLine = "";
				int j = 0;
				while (j < words.length && words[j].length() == 0) {
					System.out.println("|" + words[j] + "|");
					j++;
				}
				if (j < words.length) {
					pdfLine = words[j];
					j++;
				}

				for (; j < words.length; j++) {
					checkNewPage(gap);
					String word = words[j];
					if (normal.getStringWidth(pdfLine + " " + word) / 1000
							* normalSize < right - left) {
						pdfLine += " " + word;

					} else {
						y -= gap;
						checkLine(pdfLine);
						drawString(pdfLine, left, y, normal, normalSize);
						if (word.trim().length() > 0) {
							pdfLine = word;
						} else {
							pdfLine = "";
						}

					}
				}
				y -= gap;
				checkLine(pdfLine);
				drawString(pdfLine, left, y, normal, normalSize);
			}

			y -= 30;

			checkNewPage((season.getTeams().size() * (gap + 2) + 2));
			initY = y;
			contentStream.drawLine(x, y + gap, right, y + gap);
			contentStream.drawLine(x, y - gap / 2, right, y - gap / 2);
			x += 10;

			max = drawTeamNames(x);
			x += (max + 10);
			max = bold.getStringWidth("Trainingstag") / 1000 * normalSize;
			for (Team team : season.getTeams()) {
				float width = normal.getStringWidth(team.getTrainingday())
						/ 1000 * normalSize;
				if (width > max) {
					max = width;
				}
			}
			checkNewLine(max);
			y = initY;

			drawString("Trainingstag", x, y, bold, normalSize);
			y -= 3;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				drawString(team.getTrainingday(), x, y, normal, normalSize);
			}

			x += (max + 10);
			max = bold.getStringWidth("Uhrzeit") / 1000 * normalSize;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				float width = normal.getStringWidth(team.getTrainingtime())
						/ 1000 * normalSize;
				if (width > max) {
					max = width;
				}
			}
			checkNewLine(max);
			y = initY;

			drawString("Uhrzeit", x, y, bold, normalSize);
			y -= 3;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				drawString(team.getTrainingtime(), x, y, normal, normalSize);
			}

			x += (max + 10);
			max = bold.getStringWidth("Ort") / 1000 * normalSize;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				float width = normal.getStringWidth(team.getLocation()) / 1000
						* normalSize;
				if (width > max) {
					max = width;
				}
			}
			checkNewLine(max);
			y = initY;

			drawString("Ort", x, y, bold, normalSize);
			y -= 3;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				drawString(team.getLocation(), x, y, normal, normalSize);
			}

			x += (max + 10);
			max = bold.getStringWidth("Kontaktperson") / 1000 * normalSize;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				float width = normal.getStringWidth(team.getContact()) / 1000
						* normalSize;
				if (width > max) {
					max = width;
				}
			}
			checkNewLine(max);
			y = initY;

			drawString("Kontaktperson", x, y, bold, normalSize);
			y -= 3;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				drawString(team.getContact(), x, y, normal, normalSize);
			}
			x += (max + 10);
			max = bold.getStringWidth("Kontakt") / 1000 * normalSize;
			;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				float width = normal.getStringWidth(team.getPhone()) / 1000
						* normalSize;
				if (width > max) {
					max = width;
				}
			}
			checkNewLine(max);
			y = initY;
			drawString("Kontakt", x, y, bold, normalSize);
			y -= 3;
			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				drawString(team.getPhone(), x, y, normal, normalSize);
			}

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public void drawHeader() {
		try {
			BufferedImage img = ImageIO.read(new File("images/Logo.jpg"));
			PDXObjectImage ximage = new PDJpeg(document, img, 1.0f);
			float x = 25;
			float imgHeight = 50.f;
			float imgWidth = 42.f;
			y = page.getMediaBox().getHeight() - (imgHeight + 25);
			contentStream.drawXObject(ximage, x, y, 42, 50);
			x += imgWidth + 10;
			y = page.getMediaBox().getHeight() - 42;
			drawString("Schützenkreis Meppen", x, y, normal, 22);
			x += 1;
			y -= 14;
			drawString("www.kreis-meppen.de", x, y, normal, 12);
			y -= 12;
			String contactPerson = season.getContactPerson();
			String contactMail = season.getContactMail();
			if (contactPerson.length() > 0) {
				drawString("Kontakt: "
						+ contactPerson
						+ (contactMail.length() > 0 ? " (" + contactMail + ")"
								: ""), x, y, normal, normalSize);
			}
			y = y - 50;

			System.out.println(y);
		} catch (FileNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private void drawPersonalScore(PersonalScore score, int position,
			int startWeek, int endWeek) {
		try {
			x = left + 5;
			contentStream.drawLine(left, y + gap, left, y - gap / 2);

			drawString(String.valueOf(position), x, y, normal, normalSize);
			x += positionMax;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString(score.getShooter(), x, y, normal, normalSize);
			x += shooterMax;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString(cutTeamName(score.getTeam()), x, y, normal, normalSize);
			x += teamMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			String total = String.valueOf(score.getTotal());
			total = total.endsWith(".0") || total.endsWith(",0") ? total
					.subSequence(0, total.length() - 2).toString() : total;
			float widthTotal = normal.getStringWidth(total) / 1000 * normalSize;
			drawString(total, x + totalMax / 2 - widthTotal / 2, y, normal,
					normalSize);
			x += totalMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			String mean = String.valueOf(score.getMean());
			float meanWidth = normal.getStringWidth(mean) / 1000 * normalSize;
			drawString(mean, x + meanMax / 2 - meanWidth / 2, y, normal,
					normalSize);
			x += meanMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			for (int i = startWeek; i <= endWeek; i++) {
				String result = score.getScore(i) > 0 ? String.valueOf(score
						.getScore(i)) : "";
				result = result.endsWith(".0") || result.endsWith(",0") ? result
						.subSequence(0, result.length() - 2).toString()
						: result;
				float width = normal.getStringWidth(result) / 1000 * normalSize;
				drawString(result, x + valueMax / 2 - width / 2, y, normal,
						normalSize);
				x += valueMax;
				contentStream.drawLine(x, y + gap, x, y - gap / 2);
			}
			contentStream.drawLine(left, y - gap / 2, x, y - gap / 2);

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private void drawPersonalScoreHeader(int startWeek, int endWeek) {
		try {
			contentStream.drawLine(left, y + gap + 0.5f, left, y - gap / 2);

			x = left + 5 + positionMax;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString("Schütze/inn", x, y, bold, normalSize);
			x += shooterMax;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString("Mannschaft", x, y, bold, normalSize);
			x += teamMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			float totalWidth = bold.getStringWidth("Gesamt") / 1000
					* normalSize;
			drawString("Gesamt", x + totalMax / 2 - totalWidth / 2, y, bold,
					normalSize);
			x += totalMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);

			float meanWidth = bold.getStringWidth("Schnitt") / 1000
					* normalSize;
			drawString("Schnitt", x + meanMax / 2 - meanWidth / 2, y, bold,
					normalSize);
			x += meanMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);

			for (int i = startWeek; i <= endWeek; i++) {
				String week = String.valueOf(i);
				float width = bold.getStringWidth(week) / 1000 * normalSize;

				drawString(week, x + valueMax / 2 - width / 2, y, bold,
						normalSize);
				x += valueMax;
				contentStream.drawLine(x, y + gap, x, y - gap / 2);

			}
			contentStream.drawLine(left, y + gap, x, y + gap);

			contentStream.drawLine(left, y - gap / 2, x, y - gap / 2);
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

	public void drawPersonalScoresResult(ObservableList<PersonalScore> scores,
			String Agegroup) {
		try {
			setLandscape();
			newPage();

			drawHeader();
			x = left;
			drawString("Einzelergebnisse " + Agegroup, x, y, normal, 22);
			y -= 30;

			drawString(
					"Saison " + season.getYear() + "/"
							+ ("" + (season.getYear() + 1)).substring(2), x, y,
					normal, 14);

			drawString(season.getLabel(),
					right - normal.getStringWidth(season.getLabel()) / 1000
							* 14, y, normal, 14);

			y -= 30;
			float oldY = y;

			calculateXBorders(scores);
			int week = 1;
			int nWeeks = getNumberOfWeeks();
			while (week <= season.getMaxWeek()) {
				drawPersonalScoreHeader(week,
						Math.min(week + nWeeks, season.getMaxWeek()));
				for (int i = 0; i < scores.size(); i++) {
					PersonalScore score = scores.get(i);
					y -= (gap + 4);
					if (checkNewPage(0)) {
						drawPersonalScoreHeader(week,
								Math.min(week + nWeeks, season.getMaxWeek()));
						y -= (gap + 4);
					}
					drawPersonalScore(score, i + 1, week,
							Math.min(week + nWeeks, season.getMaxWeek()));
				}
				week = week + nWeeks + 1;
				y -= (3 * gap + 4);
			}

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

	private void drawResultTable(ObservableList<TableRow> teamResults) {
		try {
			setNormal();
			newPage();
			drawHeader();
			x = left;
			drawString("Gesamtergebnis", x, y, normal, 22);
			y -= 30;

			drawString(
					"Saison " + season.getYear() + "/"
							+ ("" + (season.getYear() + 1)).substring(2), x, y,
					normal, 14);

			drawString(season.getLabel(),
					right - normal.getStringWidth(season.getLabel()) / 1000
							* 14, y, normal, 14);

			y -= 30;
			float oldY = y;
			calculateXBordersResultTable(teamResults);
			drawTableResultHeader();
			for (int i = 0; i < teamResults.size(); i++) {
				TableRow row = teamResults.get(i);
				y -= (gap + 4);
				if (checkNewPage(0)) {
					drawTableResultHeader();
					y -= (gap + 4);
				}
				drawTableResultRow(row, i + 1);
			}

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private void drawString(String text, float x, float y, PDFont font, int size) {
		try {
			contentStream.beginText();
			contentStream.setFont(font, size);
			contentStream.moveTextPositionByAmount(x, y);
			contentStream.drawString(text);
			contentStream.endText();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private void drawStringInTable(String text, boolean center) {
		try {
			float width = normal.getStringWidth(text) / 1000 * normalSize;
			if (width > max) {
				max = width;
			}
			y -= (gap + 2);
			drawString(text, x + (center ? 30.f / 2.f - width / 2 : 0), y,
					normal, normalSize);
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private void drawTableResultHeader() {
		try {
			contentStream.drawLine(left, y + gap, left, y - gap / 2);
			contentStream.drawLine(left + 15, y + gap, left + 15, y - gap / 2);
			x = left + 20;

			drawString("Mannschaft", x, y, bold, normalSize);
			x += teamMax;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			float winWidth = bold.getStringWidth("Gewonnen") / 1000
					* normalSize;
			drawString("Gewonnen", x + winMax / 2 - winWidth / 2, y, bold,
					normalSize);
			x += winMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			float looseWidth = bold.getStringWidth("Verloren") / 1000
					* normalSize;
			drawString("Verloren", x + looseMax / 2 - looseWidth / 2, y, bold,
					normalSize);
			x += looseMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			float tiedWidth = bold.getStringWidth("Unentschieden") / 1000
					* normalSize;
			drawString("Unentschieden", x + tiedMax / 2 - tiedWidth / 2, y,
					bold, normalSize);
			x += tiedMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			float ringWidth = bold.getStringWidth("Ringe") / 1000 * normalSize;
			drawString("Ringe", x + ringMax / 2 - ringWidth / 2, y, bold,
					normalSize);
			x += ringMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			float pointWidth = bold.getStringWidth("Punkte") / 1000
					* normalSize;
			drawString("Punkte", x + pointMax / 2 - pointWidth / 2, y, bold,
					normalSize);
			x += pointMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			contentStream.drawLine(left, y + gap, x, y + gap);

			contentStream.drawLine(left, y - gap / 2, x, y - gap / 2);
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private void drawTableResultRow(TableRow row, int week) {
		try {
			x = left + 5;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString(String.valueOf(week), x, y, normal, normalSize);
			x += 15;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			drawString(cutTeamName(row.getTeam()), x, y, normal, normalSize);
			x += teamMax;
			contentStream.drawLine(x - 5, y + gap, x - 5, y - gap / 2);
			float winWidth = normal
					.getStringWidth(String.valueOf(row.getWin()))
					/ 1000
					* normalSize;
			drawString(String.valueOf(row.getWin()), x + winMax / 2 - winWidth
					/ 2, y, normal, normalSize);
			x += winMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			float looseWidth = normal.getStringWidth(String.valueOf(row
					.getLoose())) / 1000 * normalSize;
			drawString(String.valueOf(row.getLoose()), x + looseMax / 2
					- looseWidth / 2, y, normal, normalSize);
			x += looseMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);

			float tiedWidth = normal.getStringWidth(String.valueOf(row
					.getTied())) / 1000 * normalSize;
			drawString(String.valueOf(row.getTied()), x + tiedMax / 2
					- tiedWidth / 2, y, normal, normalSize);
			x += tiedMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);

			float ringWidth = normal.getStringWidth(String.valueOf(row
					.getRings())) / 1000 * normalSize;
			drawString(String.valueOf(row.getRings()), x + ringMax / 2
					- ringWidth / 2, y, normal, normalSize);
			x += ringMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);

			float pointWidth = normal.getStringWidth(String.valueOf(row
					.getPoints())) / 1000 * normalSize;
			drawString(String.valueOf(row.getPoints()), x + pointMax / 2
					- pointWidth / 2, y, normal, normalSize);
			x += pointMax;
			contentStream.drawLine(x, y + gap, x, y - gap / 2);
			contentStream.drawLine(left, y - gap / 2, x, y - gap / 2);
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private float drawTeamNames(float x) {
		try {
			drawString("Mannschaft", x, y, bold, normalSize);
			y -= 3;
			float max = bold.getStringWidth("Mannschaft") / 1000 * normalSize;

			for (Team team : season.getTeams()) {
				y -= (gap + 2);
				drawString(cutTeamName(team.getName()), x, y, normal,
						normalSize);
				float width = normal
						.getStringWidth(cutTeamName(team.getName()))
						/ 1000
						* normalSize;
				if (width > max) {
					max = width;
				}
			}
			return max;
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		return 0;

	}

	public List<Match> getMatches(int week) {
		List<Match> matchList = new ArrayList<>();
		for (Match match : season.getMatches()) {
			if (match.getWeek() == week) {
				matchList.add(match);
			}
		}
		return matchList;
	}

	private int getNumberOfWeeks() {
		float width = right - left;
		width -= (positionMax + shooterMax + teamMax + totalMax + meanMax + valueMax);
		return (int) (width / valueMax);
	}

	private void newPage() {
		try {
			if (this.contentStream != null) {
				this.contentStream.close();
			}

			this.page = new PDPage(size);
			this.document.addPage(page);
			this.y = top;
			this.contentStream = new PDPageContentStream(document, page, true,
					true);
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private void setLandscape() {
		PDRectangle normalA4 = PDPage.PAGE_SIZE_A4;
		size = new PDRectangle(normalA4.getHeight(), normalA4.getWidth());
		left = 72.f;
		bot = 25f;
		right = size.getWidth() - 37.f;
		top = size.getHeight() - bot;
	}

	private void setNormal() {
		size = PDPage.PAGE_SIZE_A4;

		left = 72.f;
		bot = 25f;
		rightBorder = 37.f;

		right = size.getWidth() - rightBorder;

		top = size.getHeight() - bot;
	}

}
