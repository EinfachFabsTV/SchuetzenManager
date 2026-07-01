package model;

import java.io.File;
import java.io.FileNotFoundException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Scanner;

import database.Database;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.scene.chart.PieChart.Data;
import pdf.PDFFactory;

public class Season {

	public static void main(String[] args) {
		// ObservableList<Team> teams = FXCollections.observableArrayList();
		//
		// teams.add(new Team("Meppen 1", "Donnerstag", "20:00",
		// "Städtischer Schießstand", "H. Brahns", "05931 / 8145"));
		// teams.add(new Team("St. Barbara Dalum 6", "Mittwoch", "20:00",
		// "Schützenhaus Danziger Str.", "M. Kramer", "05937 / 9809255"));
		// teams.add(new Team("1. Kp. Twist 1", "Montag", "19:30",
		// "Schießhalle Alfred-Delp Str.", "W. Fischer", "05936 / 1327"));
		// teams.add(new Team("St. Barbara Dalum 5", "Mittwoch", "20:00",
		// "Schützenhaus Danziger Str.", "P. Kramer", "05937 / 7103"));
		//
		// teams.add(new Team("St. Barbara Dalum 4", "Mittwoch", "20:00",
		// "Schützenhaus Danziger Str.", "U. Rathkamp", "05937 / 7103"));
		// teams.add(new Team("Geeste 1", "Dienstag", "20:00",
		// "Schießhalle Geeste", "F. Günnemann", "05907 / 1441"));
		//
		// Season season2 = new Season(2013, "L.G. Auflage A", teams);
		//
		// Season season = new Season(2013, "L.G. Auflage A", teams,
		// season2.getMatches(), season2.dates, season2.getConfig());
		//
		// for (int i = 0; i < season.tables.size(); i++) {
		// System.out.println("Tabelle nach Woche " + i);
		// System.out.println("Team | Win | Loos | Tied | Score | Points");
		// ObservableList<TableRow> table = season.tables.get(i);
		// for (int j = 0; j < table.size(); j++) {
		// System.out.println(table.get(j));
		// }
		// }
		// System.out.println("\n#####change######");
		// System.out.println("Week: " + season.matches.get(4).getWeek() + " "
		// + season.matches.get(4).getHometeam() + " vs "
		// + season.matches.get(4).getGuestteam());
		// System.out.println("T1; " + season.matches.get(4).getHometeam());
		//
		// season.matches.get(4).getHomeShoots().get(0).setFirstname("Christian");
		// season.matches.get(4).getHomeShoots().get(0).setLastname("Kater");
		// season.matches.get(4).getHomeShoots().get(0)
		// .setAgegroup(Agegroup.SCHUETZENKLASSE.toString());
		// season.matches.get(4).getHomeShoots().get(0).setScore(200);
		// System.out.println("T2; " + season.matches.get(2).getGuestteam());
		// season.matches.get(2).getGuestShoots().get(0).setFirstname("Peter");
		// season.matches.get(2).getGuestShoots().get(0).setLastname("Kater");
		// season.matches.get(2).getGuestShoots().get(0)
		// .setAgegroup(Agegroup.SCHUETZENKLASSE.toString());
		// season.matches.get(2).getGuestShoots().get(0).setScore(100);
		// // season.matches.get(4).getHomeShoots().get(1).setScore(200);
		// // season.matches.get(4).getGuestShoots().get(0).setScore(300);
		// // season.matches.get(4).getGuestShoots().get(1).setScore(300);
		// System.out.println(season.matches.get(4).getHomeScore() + " vs "
		// + season.matches.get(4).getGuestScore());
		// System.out.println("#####/change#####\n");
		// season.config
		// .put("infoBox",
		// "Wettkampfmeldungen, die bis Mittwoch nach angegebenen Endtermin nicht vorliegen, werden mit 5 Euro Strafgeld für den Heimverein belegt.\n\nDie Heimmannschaft darf, nach Absprache mit der Gastmannschaft, den im Plan genannten Termin bis zum Wettkampfwochenende verlegen.\nDer Sieger nimmt an den Aufstiegsmöglichkeiten zur Bezirksklasse teil. Die zwei letzen Mannschaften in der Tabelle steigen in die Kreisklasse B ab.");
		// season.config.put("contactPerson", "Walter Kramer");
		// season.config.put("contactMail", "kramer17@t-online.de");
		// season.dates.get(0).set("16.09.2013");
		// season.dates.get(1).set("30.09.2013");
		// season.dates.get(2).set("14.10.2013");
		// season.dates.get(3).set("28.10.2013");
		// season.dates.get(4).set("11.11.2013");
		// season.dates.get(5).set("25.11.2013");
		// season.dates.get(6).set("09.12.2013");
		// season.dates.get(7).set("06.01.2014");
		// season.dates.get(8).set("20.01.2014");
		// season.dates.get(9).set("03.02.2014");
		// season.dates.get(10).set("17.02.2014");
		// // season.dates.get(11).set("03.03.2014");
		// // season.dates.get(12).set("17.03.2014");
		// // season.dates.get(13).set("31.03.2014");
		//
		// season = new Season(2013, "L.G. Auflage A", teams,
		// season.getMatches(),
		// season.dates, season.getConfig());
		//
		// for (int i = 0; i < season.tables.size(); i++) {
		// System.out.println();
		// System.out.println("Tabelle nach Woche " + i);
		// System.out.println("Team | Win | Loos | Tied | Score | Points");
		// ObservableList<TableRow> table = season.tables.get(i);
		// for (int j = 0; j < table.size(); j++) {
		// System.out.println(table.get(j));
		// }
		// }
		//
		// for (PersonalScore score : season.scores.get(0)) {
		// System.out.println(score.getShooter() + " | " + score.getTeam()
		// + " | " + score.getMean() + " | " + score.getTotal());
		// }
		//
		// PDFFactory pdf = new PDFFactory();
		// pdf.createPDF(season, new File("Runden.pdf"));
//		ObservableList<Team> teams = FXCollections.observableArrayList();
//		File file = new File("team.csv");
//
//		try {
//			Scanner scanner = new Scanner(file);
//			// skip first line
//			String nextLine = scanner.nextLine();
//			while (scanner.hasNextLine()) {
//				nextLine = scanner.nextLine();
//				String[] split = nextLine.split(";");
//				teams.add(new Team(split[0], split[1], split[2], split[3],
//						split[4], split[5]));
//			}
//		} catch (FileNotFoundException e) {
//			e.printStackTrace();
//		}
//		Season season = new Season(2013, "L.G. Auflage A", teams);
//		season.matches.clear();
//		file = new File("match.csv");
//		try {
//			Scanner scanner = new Scanner(file);
//			// skip first line
//			String nextLine = scanner.nextLine();
//			while (scanner.hasNextLine()) {
//				nextLine = scanner.nextLine();
//				String[] split = nextLine.split(";");
//				season.matches.add(new Match(season.getTeam(split[1]), season
//						.getTeam(split[2]), Integer.parseInt(split[0])));
//			}
//		} catch (FileNotFoundException e) {
//			e.printStackTrace();
//		}
//		file = new File("shoot_normalAge.csv");
//		try {
//			Scanner scanner = new Scanner(file);
//			// skip first line
//			String nextLine = scanner.nextLine();
//			while (scanner.hasNextLine()) {
//				nextLine = scanner.nextLine();
//				String[] split = nextLine.split(";");
//
//				String firstname = split[1];
//				String lastname = split[0];
//				String team = split[2];
//				System.out.println(firstname + " " + lastname + ", " + team);
//				double total = Double.parseDouble(split[3]);
//				double mean = Double.parseDouble(split[4]);
//				for (int i = 1; i <= 14; i++) {
//					double score = 0;
//					try {
//						score = Double.parseDouble(split[i + 4]);
//					} catch (NumberFormatException e) {
//
//					}
//					for (Match match : season.matches) {
//						if (match.getWeek() == i) {
//							if (team.equals(match.getHometeam()) && score > 0) {
//								match.getHomeShoots().add(
//										new Shoot(firstname, lastname, 0, 0,
//												Agegroup.SCHUETZENKLASSE
//														.toString(), score));
//							}
//							if (team.equals(match.getGuestteam()) && score > 0) {
//								match.getGuestShoots().add(
//										new Shoot(firstname, lastname, 0, 0,
//												Agegroup.SCHUETZENKLASSE
//														.toString(), score));
//							}
//						}
//					}
//				}
//			}
//		} catch (FileNotFoundException e) {
//			e.printStackTrace();
//		}
//		file = new File("shoot_senior.csv");
//		try {
//			Scanner scanner = new Scanner(file);
//			// skip first line
//			String nextLine = scanner.nextLine();
//			while (scanner.hasNextLine()) {
//				nextLine = scanner.nextLine();
//				String[] split = nextLine.split(";");
//
//				String firstname = split[0];
//				String lastname = split[1];
//				String team = split[2];
//				double total = Double.parseDouble(split[3]);
//				double mean = Double.parseDouble(split[4]);
//				for (int i = 1; i <= 14; i++) {
//					double score = 0;
//					try {
//						score = Double.parseDouble(split[i + 4]);
//					} catch (NumberFormatException e) {
//
//					}
//					boolean add = false;
//					for (Match match : season.matches) {
//						if (match.getWeek() == i) {
//							if (team.equals(match.getHometeam())) {
//								match.getHomeShoots().add(
//										new Shoot(firstname, lastname, 0, 0,
//												Agegroup.SENIOREN.toString(),
//												score));
//								add = true;
//							}
//							if (team.equals(match.getGuestteam())) {
//								match.getGuestShoots().add(
//										new Shoot(firstname, lastname, 0, 0,
//												Agegroup.SENIOREN.toString(),
//												score));
//								add = true;
//							}
//						}
//					}
//					if (!add) {
//						System.out.println(firstname + " " + lastname + ", "
//								+ team);
//					}
//				}
//			}
//		} catch (FileNotFoundException e) {
//			e.printStackTrace();
//		}
//		Database.getInstance().createSeason(season);
//		for (Match match : season.matches) {
//			// Database.getInstance().updateMatch(match, 9);
//		}

	}

	public static final DateTimeFormatter dateFormatter = DateTimeFormatter
			.ofPattern("dd.MM.yyyy");
	public final SimpleIntegerProperty year = new SimpleIntegerProperty();

	public final SimpleStringProperty label = new SimpleStringProperty();
	private ObservableList<Team> teams;

	public ObservableList<Match> matches;

	public ObservableList<ObservableList<TableRow>> tables;
	public HashMap<String, String> config;

	private int maxWeek;

	public ObservableList<ObservableList<PersonalScore>> scores;

	public ObservableList<SimpleStringProperty> dates;

	public Season(int year, String label, ObservableList<Team> teams) {
		setYear(year);
		setLabel(label);
		config = new HashMap<>();
		this.teams = teams;
		maxWeek = teams.size() % 2 != 0 ? teams.size() * 2
				: (teams.size() - 1) * 2;
		tables = FXCollections.observableArrayList();
		dates = FXCollections.observableArrayList();
		for (int i = 0; i <= maxWeek; i++) {
			tables.add(FXCollections.observableArrayList());
			SimpleStringProperty date = new SimpleStringProperty();
			date.set("");
			dates.add(date);
		}
		scores = FXCollections.observableArrayList();
		for (int i = 0; i < Agegroup.numberOfElements; i++) {
			scores.add(FXCollections.observableArrayList());
		}
//		computeMatches();
		RandomRoundRobin rrr = new RandomRoundRobin();
		this.matches = FXCollections.observableArrayList();
		for (Match match : rrr.computeMatches(teams).matches) {
			addMatch(getTeam(match.getHometeam()),
					getTeam(match.getGuestteam()), match);
		}
		initialize();
		removeZeroScores();

	}

	public Season(int year, String label, ObservableList<Team> teams,
			ObservableList<Match> matches,
			ObservableList<SimpleStringProperty> dates,
			HashMap<String, String> config) {
		setYear(year);
		setLabel(label);
		this.config = config;
		this.teams = teams;
		maxWeek = teams.size() % 2 != 0 ? teams.size() * 2
				: (teams.size() - 1) * 2;
		tables = FXCollections.observableArrayList();
		this.dates = dates;
		for (int i = 0; i <= maxWeek; i++) {
			tables.add(FXCollections.observableArrayList());
		}
		scores = FXCollections.observableArrayList();
		for (int i = 0; i < Agegroup.numberOfElements; i++) {
			scores.add(FXCollections.observableArrayList());
		}
		this.matches = FXCollections.observableArrayList();
		for (Match match : matches) {
			addMatch(getTeam(match.getHometeam()),
					getTeam(match.getGuestteam()), match);
		}
		initialize();
		removeZeroScores();

	}

	private void initialize() {
		for (Match match : matches) {
			for (Shoot shoot : match.getHomeShoots()) {
				PersonalScore persScore = getPersonalScore(shoot.getAgegroup(),
						shoot.getFirstname() + " " + shoot.getLastname(),
						getTeam(match.getHometeam()));
				persScore.setScore(match.getWeek(), shoot.getScore());
			}
			for (Shoot shoot : match.getGuestShoots()) {
				PersonalScore persScore = getPersonalScore(shoot.getAgegroup(),
						shoot.getFirstname() + " " + shoot.getLastname(),
						getTeam(match.getGuestteam()));
				persScore.setScore(match.getWeek(), shoot.getScore());
			}
			for (Shoot shoot : match.getAddHomeShoots()) {
				PersonalScore persScore = getPersonalScore(shoot.getAgegroup(),
						shoot.getFirstname() + " " + shoot.getLastname(),
						getTeam(match.getHometeam()));
				persScore.setScore(match.getWeek(), shoot.getScore());
			}
			for (Shoot shoot : match.getAddGuestShoots()) {
				PersonalScore persScore = getPersonalScore(shoot.getAgegroup(),
						shoot.getFirstname() + " " + shoot.getLastname(),
						getTeam(match.getGuestteam()));
				persScore.setScore(match.getWeek(), shoot.getScore());
			}
		}

	}

	private void addMatch(Team homeTeam, Team guestTeam, int week) {
		if (homeTeam != null && guestTeam != null) {
			Match match = new Match(homeTeam, guestTeam, week);
			matches.add(match);
			match.setDate("");
			match.date.bind(dates.get(week - 1));
			ObservableList<Shoot> homeShoots = match.getHomeShoots();
			ObservableList<Shoot> guestShoots = match.getGuestShoots();
			for (Shoot shoot : homeShoots) {
				addPersonalScoreListener(shoot, week, homeTeam);
			}
			for (Shoot shoot : guestShoots) {
				addPersonalScoreListener(shoot, week, guestTeam);
			}
			for (int i = 0; i <= maxWeek; i++) {
				final TableRow homeTable = getTable(homeTeam, i);
				final TableRow guestTable = getTable(guestTeam, i);

				match.homeScore.addListener(getMatchScoreListener(homeTable,
						guestTable, match, true));
				match.guestScore.addListener(getMatchScoreListener(guestTable,
						homeTable, match, false));
				if (i == 0) {
					i = week - 1;
				}
			}
		}
	}

	private void addMatch(Team homeTeam, Team guestTeam, Match match) {
		if (homeTeam != null && guestTeam != null) {
			int week = match.getWeek();
			matches.add(match);
			match.date.bind(dates.get(week - 1));
			ObservableList<Shoot> homeShoots = match.getHomeShoots();
			ObservableList<Shoot> guestShoots = match.getGuestShoots();
			for (Shoot shoot : homeShoots) {
				addPersonalScoreListener(shoot, week, homeTeam);
			}
			for (Shoot shoot : guestShoots) {
				addPersonalScoreListener(shoot, week, guestTeam);
			}
			ObservableList<Shoot> addHomeShoots = match.getHomeShoots();
			ObservableList<Shoot> addGuestShoots = match.getGuestShoots();
			for (Shoot shoot : addHomeShoots) {
				addPersonalScoreListener(shoot, week, homeTeam);
			}
			for (Shoot shoot : addGuestShoots) {
				addPersonalScoreListener(shoot, week, guestTeam);
			}

			for (int i = 0; i <= maxWeek; i++) {
				final TableRow homeTable = getTable(homeTeam, i);
				final TableRow guestTable = getTable(guestTeam, i);

				double home = match.getHomeScore();
				double guest = match.getGuestScore();
				if (home > 0 || guest > 0) {
					// add new values
					if (home > guest) {
						homeTable.increaseWin();
						guestTable.increaseLoose();
						homeTable.setPoints(homeTable.getPoints() + 2);
					} else if (home == guest) {
						homeTable.increaseTied();
						guestTable.increaseTied();
						homeTable.setPoints(homeTable.getPoints() + 1);
						guestTable.setPoints(guestTable.getPoints() + 1);
					} else {
						guestTable.increaseWin();
						homeTable.increaseLoose();
						guestTable.setPoints(guestTable.getPoints() + 2);
					}
					homeTable.setRings(homeTable.getRings() + home);
					guestTable.setRings(guestTable.getRings() + guest);
				}

				match.homeScore.addListener(getMatchScoreListener(homeTable,
						guestTable, match, true));
				match.guestScore.addListener(getMatchScoreListener(guestTable,
						homeTable, match, false));
				if (i == 0) {
					i = week - 1;
				}
			}
		}
	}

	private void addPersonalScoreListener(Shoot shoot, int week, Team team) {

		shoot.firstname.addListener((observable, oldValue, newValue) -> {
			PersonalScore oldPersScore = getPersonalScore(shoot.getAgegroup(),
					oldValue + " " + shoot.getLastname(), team);
			oldPersScore.setScore(week, 0);
			PersonalScore newPersScore = getPersonalScore(shoot.getAgegroup(),
					newValue + " " + shoot.getLastname(), team);
			newPersScore.setScore(week, shoot.getScore());
		});
		shoot.lastname.addListener((observable, oldValue, newValue) -> {
			PersonalScore oldPersScore = getPersonalScore(shoot.getAgegroup(),
					shoot.getFirstname() + " " + oldValue, team);
			oldPersScore.setScore(week, 0);
			PersonalScore newPersScore = getPersonalScore(shoot.getAgegroup(),
					shoot.getFirstname() + " " + newValue, team);
			newPersScore.setScore(week, shoot.getScore());
		});
		shoot.agegroup.addListener((observable, oldValue, newValue) -> {
			PersonalScore oldPersScore = getPersonalScore(oldValue,
					shoot.getFirstname() + " " + shoot.getLastname(), team);
			oldPersScore.setScore(week, 0);
			PersonalScore newPersScore = getPersonalScore(newValue,
					shoot.getFirstname() + " " + shoot.getLastname(), team);
			newPersScore.setScore(week, shoot.getScore());
		});
		shoot.score.addListener((observable, oldValue, newValue) -> {

			PersonalScore persScore = getPersonalScore(shoot.getAgegroup(),
					shoot.getFirstname() + " " + shoot.getLastname(), team);
			persScore.setScore(week, newValue.doubleValue());

		});

	}

	private void computeMatches() {
		matches = FXCollections.observableArrayList();
		ArrayList<Team> teamsTmp = new ArrayList<>(teams);
		if (teams.size() % 2 != 0) {
			teamsTmp.add(null);
		}
		int numWeeks = teamsTmp.size() - 1;
		int halfSize = teamsTmp.size() / 2;
		teamsTmp.remove(0);

		int teamSize = teamsTmp.size();
		int week = 0;
		Team homeTeam = null;
		Team guestTeam = null;
		for (; week < numWeeks; week++) {
			int teamIdx = week % teamSize;
			homeTeam = teamsTmp.get(teamIdx);
			guestTeam = teams.get(0);
			addMatch(homeTeam, guestTeam, week + 1);
			for (int idx = 1; idx < halfSize; idx++) {
				homeTeam = teamsTmp.get((week + idx) % teamSize);
				guestTeam = teamsTmp.get((week + teamSize - idx) % teamSize);
				addMatch(homeTeam, guestTeam, week + 1);
			}
		}
		numWeeks *= 2;
		for (; week < numWeeks; week++) {
			int teamIdx = week % teamSize;
			homeTeam = teams.get(0);
			guestTeam = teamsTmp.get(teamIdx);
			addMatch(homeTeam, guestTeam, week + 1);
			for (int idx = 1; idx < halfSize; idx++) {
				homeTeam = teamsTmp.get((week + teamSize - idx) % teamSize);
				guestTeam = teamsTmp.get((week + idx) % teamSize);
				addMatch(homeTeam, guestTeam, week + 1);
			}
		}
	}

	public HashMap<String, String> getConfig() {
		return config;
	}

	public String getContactMail() {
		String contactMail = config.get("contactMail");
		return contactMail != null ? contactMail : "";
	}

	public String getContactPerson() {
		String contactPerson = config.get("contactPerson");
		return contactPerson != null ? contactPerson : "";
	}

	public ObservableList<SimpleStringProperty> getDates() {
		return dates;
	}

	public void setInfoBox(String infobox) {
		config.put("infoBox", infobox);
	}

	public void setContactMail(String mail) {
		config.put("contactMail", mail);
	}

	public void setContactPerson(String person) {
		config.put("contactPerson", person);
	}

	public String getInfoBox() {
		String infoBox = config.get("infoBox");
		return infoBox != null ? infoBox : "";
	}

	public String getLabel() {
		return label.get();
	}

	public ObservableList<Match> getMatches() {
		return matches;
	}

	private ChangeListener<? super Number> getMatchScoreListener(
			TableRow homeTable, TableRow guestTable, Match match, boolean home) {
		return (observable, oldValue, newValue) -> {
			double opponentScore = home ? match.getGuestScore() : match
					.getHomeScore();
			if (oldValue.doubleValue() > 0 || opponentScore > 0) {
				// remove old values
				if (oldValue.doubleValue() > opponentScore) {
					homeTable.decreaseWin();
					guestTable.decreaseLoose();
					homeTable.setPoints(homeTable.getPoints() - 2);
				} else if (oldValue.doubleValue() == opponentScore) {
					homeTable.decreaseTied();
					guestTable.decreaseTied();
					homeTable.setPoints(homeTable.getPoints() - 1);
					guestTable.setPoints(guestTable.getPoints() - 1);
				} else {
					guestTable.decreaseWin();
					homeTable.decreaseLoose();
					guestTable.setPoints(guestTable.getPoints() - 2);
				}
				homeTable.setRings(homeTable.getRings()
						- oldValue.doubleValue());
			}

			if (newValue.doubleValue() > 0 || opponentScore > 0) {
				// add new values
				if (newValue.doubleValue() > opponentScore) {
					homeTable.increaseWin();
					guestTable.increaseLoose();
					homeTable.setPoints(homeTable.getPoints() + 2);
				} else if (newValue.doubleValue() == opponentScore) {
					homeTable.increaseTied();
					guestTable.increaseTied();
					homeTable.setPoints(homeTable.getPoints() + 1);
					guestTable.setPoints(guestTable.getPoints() + 1);
				} else {
					guestTable.increaseWin();
					homeTable.increaseLoose();
					guestTable.setPoints(guestTable.getPoints() + 2);
				}
				homeTable.setRings(homeTable.getRings()
						+ newValue.doubleValue());
			}
		};
	}

	public int getMaxWeek() {
		return maxWeek;
	}

	private PersonalScore getPersonalScore(String agegroupStr, String shooter,
			Team team) {
		int agegroup = Agegroup.getAgegroup(agegroupStr).getID();
		ObservableList<PersonalScore> persScore = scores.get(agegroup);
		for (PersonalScore personalScore : persScore) {
			if (personalScore.getShooter().equals(shooter)
					&& personalScore.getTeam().equals(team.getName())) {
				return personalScore;
			}
		}
		PersonalScore pScore = new PersonalScore(maxWeek, team, shooter);
		persScore.add(pScore);
		return pScore;
	}

	public ObservableList<ObservableList<PersonalScore>> getScores() {
		return scores;
	}

	private TableRow getTable(Team team, int week) {
		ObservableList<TableRow> table = tables.get(week);
		for (TableRow row : table) {
			if (row.getTeam().equals(team.getName())) {
				return row;
			}
		}
		TableRow row = new TableRow(team);
		tables.get(week).add(row);
		return row;
	}

	public ObservableList<ObservableList<TableRow>> getTables() {
		return tables;
	}

	public Team getTeam(String teamName) {
		for (Team team : teams) {
			if (teamName.equals(team.getName())) {
				return team;
			}
		}
		return null;
	}

	public ObservableList<Team> getTeams() {
		return teams;
	}

	public int getYear() {
		return year.get();
	}

	public void setConfig(HashMap<String, String> config) {
		this.config = config;
	}

	public void setDates(ObservableList<SimpleStringProperty> dates) {
		this.dates = dates;
	}

	public void setLabel(String label) {
		this.label.set(label);
	}

	public void setMatches(ObservableList<Match> matches) {
		this.matches = matches;
	}

	public void setScores(ObservableList<ObservableList<PersonalScore>> scores) {
		this.scores = scores;
	}

	public void setTables(ObservableList<ObservableList<TableRow>> tables) {
		this.tables = tables;
	}

	public void setTeams(ObservableList<Team> teams) {
		this.teams = teams;
	}

	public void setYear(int year) {
		this.year.set(year);
		;
	}

	public void removeZeroScores() {
		for (ObservableList<PersonalScore> scoreList : scores) {
			for (int i = 0; i < scoreList.size();) {
				PersonalScore score = scoreList.get(i);
				if (score.getTotal() <= 0) {
					scoreList.remove(i);
				} else {
					i++;
				}
			}
		}
	}

	public Shoot getNewAditionalShoot(Match match, boolean home) {
		Shoot shoot = new Shoot("", "", 0, 0,
				Agegroup.SCHUETZENKLASSE.toString(), 0);
		addPersonalScoreListener(
				shoot,
				match.getWeek(),
				home ? getTeam(match.getHometeam()) : getTeam(match
						.getGuestteam()));

		return shoot;
	}
}
