package database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;

import property.PropertiyFactory;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import model.Agegroup;
import model.Match;
import model.Responsible;
import model.Season;
import model.SeasonRow;
import model.Shoot;
import model.Team;
import model.User;
import view.ShootingAdministration;
import view.WeekToDateElement;

public class Database {
	public static Database getInstance() {
		if (instance == null) {
			instance = new Database();
		}
		return instance;
	}

	private static Database instance;
	private final int DB_VERSION = 1;
	private Connection con;
	private Connection remoteCon;

	private Season season;
	private ShootingAdministration shootingAdmin;
	int id;

	private ObservableList<SeasonRow> seasonRows;

	private Database() {
		try {

			seasonRows = FXCollections.observableArrayList();
			Class.forName("org.sqlite.JDBC");
			con = DriverManager.getConnection("jdbc:sqlite:database.db");
			Statement stmt = con.createStatement();
			stmt.execute("PRAGMA foreign_keys = ON");

			String sql = "CREATE TABLE IF NOT EXISTS config( "
					+ "configkey 			INT 	NOT NULL,"
					+ "configvalue    		TEXT    NOT NULL,"
					+ "PRIMARY KEY(configkey));"

					+ "CREATE TABLE IF NOT EXISTS seasonconfig( "
					+ "configkey 			INT 	NOT NULL,"
					+ "configvalue    		TEXT    NOT NULL,"
					+ "season 				INT  	NOT NULL,"
					+ "PRIMARY KEY(configkey, season));"

					+ "CREATE TABLE IF NOT EXISTS season("
					+ "season	 		INTEGER	PRIMARY KEY,"
					+ "year 			INT  	NOT NULL,"
					+ "label	 		TEXT 	NOT NULL);"

					+ "CREATE TABLE IF NOT EXISTS team("
					+ "name				TEXT	NOT NULL,"
					+ "season 			INT  	NOT NULL,"
					+ "trainingday		TEXT 	NULL,"
					+ "trainingtime 	TEXT	NULL,"
					+ "location			TEXT	NULL,"
					+ "contact			TEXT	NULL,"
					+ "phone			TEXT 	NULL,"
					+ "FOREIGN KEY(season) REFERENCES season(season),"
					+ "PRIMARY KEY(name, season));"

					+ "CREATE TABLE IF NOT EXISTS match("
					+ "hometeam			TEXT	NOT NULL,"
					+ "guestteam		TEXT	NOT NULL,"
					+ "season 			INT  	NOT NULL,"
					+ "week				INT		NOT NULL,"
					+ "FOREIGN KEY(hometeam, season) REFERENCES team(name, season),"
					+ "FOREIGN KEY(guestteam, season) REFERENCES team(name, season),"
					+ "PRIMARY KEY(hometeam, guestteam, season));"

					+ "CREATE TABLE IF NOT EXISTS dates("
					+ "week				INT		NOT NULL,"
					+ "date				TEXT	NOT NULL,"
					+ "season 			INT  	NOT NULL,"
					+ "FOREIGN KEY(season) REFERENCES season(season),"
					+ "PRIMARY KEY(week, season));"

					+ "CREATE TABLE IF NOT EXISTS shoot("
					+ "hometeam			TEXT	NOT NULL,"
					+ "guestteam		TEXT	NOT NULL,"
					+ "season 			INT  	NOT NULL,"
					+ "firstname		TEXT	NOT NULL,"
					+ "lastname			TEXT	NOT NULL,"
					+ "agegroup			TEXT	NOT NULL,"
					+ "team				TEXT	NOT NULL,"
					+ "startid			INT		NULL,"
					+ "endid			INT 	NULL,"
					+ "result 			NUMBER	NOT NULL,"
					+ "FOREIGN KEY(hometeam, guestteam, season) REFERENCES match(hometeam, guestteam, season),"
					+ "PRIMARY KEY(hometeam, guestteam, season, firstname, lastname));"

					+ "CREATE TABLE IF NOT EXISTS additionalshoot("
					+ "hometeam			TEXT	NOT NULL,"
					+ "guestteam		TEXT	NOT NULL,"
					+ "season 			INT  	NOT NULL,"
					+ "firstname		TEXT	NOT NULL,"
					+ "lastname			TEXT	NOT NULL,"
					+ "agegroup			TEXT	NOT NULL,"
					+ "team				TEXT	NOT NULL,"
					+ "startid			INT		NULL,"
					+ "endid			INT 	NULL,"
					+ "result 			NUMBER	NOT NULL,"
					+ "FOREIGN KEY(hometeam, guestteam, season) REFERENCES match(hometeam, guestteam, season),"
					+ "PRIMARY KEY(hometeam, guestteam, season, firstname, lastname));"

					+ "CREATE TABLE IF NOT EXISTS teamnameneedupdate("
					+ "changeID			INTEGER 	NOT NULL,"
					+ "oldName			TEXT	NOT NULL," + "newName			TEXT	NOT NULL,"
					+ "PRIMARY KEY(oldName, newName, changeID));";

			stmt.executeUpdate(sql);
			ResultSet rows = stmt
					.executeQuery("SELECT season, year, label FROM season");
			rows.next();
			while (!rows.isAfterLast()) {
				seasonRows.add(new SeasonRow(rows.getInt("season"), rows
						.getString("label"), rows.getInt("year")));
				rows.next();
			}
			rows.close();
			stmt.close();

			if (getConfiguration("seasonCount") == null) {
				setConfiguration("seasonCount", PropertiyFactory.get("first_season_id"));
			}
			if (getConfiguration("teamNameCount") == null) {
				setConfiguration("teamNameCount", String.valueOf(1));
			}
		} catch (ClassNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (SQLException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public void setConfiguration(String key, String value) {
		try {
			PreparedStatement stmt = con
					.prepareStatement("UPDATE config SET configvalue = ? WHERE configkey = ?");
			stmt.setString(1, value);
			stmt.setString(2, key);
			if (stmt.executeUpdate() == 0) {
				PreparedStatement insert = con
						.prepareStatement("INSERT INTO config(configvalue, configkey) VALUES(?,?);");
				insert.setString(1, value);
				insert.setString(2, key);
				insert.executeUpdate();
				insert.close();
			}
			stmt.close();
		} catch (SQLException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public String getConfiguration(String key) {
		String resultStr = null;
		try {
			PreparedStatement stmt = con
					.prepareStatement("SELECT configvalue FROM config WHERE configkey = ?");
			stmt.setString(1, key);
			ResultSet result = stmt.executeQuery();
			if (result.next()) {
				resultStr = result.getString("configvalue");
			}
			result.close();
			stmt.close();
		} catch (SQLException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		return resultStr;

	}

	public void initRemote() throws SQLException {
		if (remoteCon == null) {
			try {
				// Class.forName("com.mysql.jdbc.Driver");
				Class.forName("de.root1.jpmdbc.Driver");
				Properties connProperties = new Properties();
				connProperties.setProperty("user", PropertiyFactory.get("db_user"));
				connProperties.setProperty("password", PropertiyFactory.get("db_password"));
	            connProperties.setProperty("port", PropertiyFactory.get("db_port"));
	            connProperties.setProperty("compression", "false");
	            

				remoteCon = DriverManager
						.getConnection("jdbc:jpmdbc:" + PropertiyFactory.get("db_host") + "?" + PropertiyFactory.get("db_name"), connProperties);
				
			} catch (ClassNotFoundException e1) {
				System.out.println("class for mysql db not found");
			}
		}
	}

	public void commitRemoteTransaction() throws SQLException {

		initRemote();
		remoteCon.commit();
	}

	public void createSeason(Season season) {
		try {
			int seasonCount = Integer.parseInt(getConfiguration("seasonCount"));
			setConfiguration("seasonCount", String.valueOf(seasonCount + 1));
			PreparedStatement stmt = con
					.prepareStatement("INSERT INTO season (season, year, label) values (?, ?, ?);");
			stmt.setInt(1, seasonCount);
			stmt.setInt(2, season.getYear());
			stmt.setString(3, season.getLabel());
			stmt.executeUpdate();
			ResultSet row = stmt.getGeneratedKeys();
			int id = row.getInt(1);
			seasonRows.add(new SeasonRow(id, season.getLabel(), season
					.getYear()));

			stmt.close();

			stmt = con
					.prepareStatement("INSERT INTO team (name, season, trainingday, trainingtime, location, contact, phone) VALUES(?, ?, ?, ?,?, ?, ?);");
			for (Team team : season.getTeams()) {
				stmt.setString(1, team.getName());
				stmt.setInt(2, id);
				stmt.setString(3, team.getTrainingday());
				stmt.setString(4, team.getTrainingtime());
				stmt.setString(5, team.getLocation());
				stmt.setString(6, team.getContact());
				stmt.setString(7, team.getPhone());
				stmt.execute();
			}
			stmt.close();

			stmt = con
					.prepareStatement("INSERT INTO match (hometeam, guestteam, season, week) VALUES(?,?,?,?);");
			PreparedStatement insertShoot = con
					.prepareStatement("INSERT INTO shoot (hometeam, guestteam, season, firstname, lastname, team, agegroup, startid, endid, result) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?);");
			for (Match match : season.getMatches()) {
				System.out.println(match);
				stmt.setString(1, match.getHometeam());
				stmt.setString(2, match.getGuestteam());
				stmt.setInt(3, id);
				stmt.setInt(4, match.getWeek());
				stmt.execute();

				for (Shoot shoot : match.getHomeShoots()) {
					if (shoot.getFirstname().length() > 0
							|| shoot.getLastname().length() > 0) {

						insertShoot.setString(1, match.getHometeam());
						insertShoot.setString(2, match.getGuestteam());
						insertShoot.setInt(3, id);
						insertShoot.setString(4, shoot.getFirstname());
						insertShoot.setString(5, shoot.getLastname());
						insertShoot.setString(6, match.getHometeam());
						insertShoot.setString(7, shoot.getAgegroup());
						insertShoot.setInt(8, shoot.getStartID());
						insertShoot.setInt(9, shoot.getEndID());
						insertShoot.setDouble(10, shoot.getScore());
						insertShoot.execute();
					}
				}
				for (Shoot shoot : match.getGuestShoots()) {
					if (shoot.getFirstname().length() > 0
							|| shoot.getLastname().length() > 0) {
						insertShoot.setString(1, match.getHometeam());
						insertShoot.setString(2, match.getGuestteam());
						insertShoot.setInt(3, id);
						insertShoot.setString(4, shoot.getFirstname());
						insertShoot.setString(5, shoot.getLastname());
						insertShoot.setString(6, match.getGuestteam());
						insertShoot.setString(7, shoot.getAgegroup());
						insertShoot.setInt(8, shoot.getStartID());
						insertShoot.setInt(9, shoot.getEndID());
						insertShoot.setDouble(10, shoot.getScore());
						insertShoot.execute();
					}
				}

			}
			insertShoot.close();
			stmt.close();

			ObservableList<SimpleStringProperty> dates = season.getDates();
			stmt = con
					.prepareStatement("INSERT INTO dates (week, date, season) VALUES(?,?,?);");
			for (int i = 0; i < season.getDates().size(); i++) {
				SimpleStringProperty date = dates.get(i);

				stmt.setInt(1, i);
				stmt.setString(2, date.get());
				stmt.setInt(3, id);
				stmt.execute();
			}
			stmt.close();

			stmt = con
					.prepareStatement("INSERT INTO seasonconfig (configkey, configvalue, season) VALUES(?, ?, ?);");
			stmt.setString(1, "infoBox");
			stmt.setString(2, season.getInfoBox());
			stmt.setInt(3, id);
			stmt.execute();
			stmt.close();

			stmt = con
					.prepareStatement("INSERT INTO seasonconfig (configkey, configvalue, season) VALUES(?, ?, ?);");
			stmt.setString(1, "contactMail");
			stmt.setString(2, season.getContactMail());
			stmt.setInt(3, id);
			stmt.execute();
			stmt.close();

			stmt = con
					.prepareStatement("INSERT INTO seasonconfig (configkey, configvalue, season) VALUES(?,?, ?);");
			stmt.setString(1, "contactPerson");
			stmt.setString(2, season.getContactPerson());
			stmt.setInt(3, id);
			stmt.execute();
			stmt.close();

			Collections.sort(seasonRows, (first, second) -> {
				int compare = second.getYear() - first.getYear();
				if (compare == 0) {
					compare = first.getLabel().compareTo(second.getLabel());
				}
				return compare;
			});
		} catch (SQLException e) {
			e.printStackTrace();
		}

	}

	public void deleteSeason(int id) {
		String[] tables = new String[] { "seasonconfig", "shoot", "dates",
				"match", "team", "season" };
		try {
			Statement st = con.createStatement();
			st.execute("PRAGMA foreign_keys = OFF");
			st.close();
			for (int i = 0; i < tables.length; i++) {
				PreparedStatement stmt = con.prepareStatement("DELETE FROM "
						+ tables[i] + " WHERE season = ?");
				stmt.setInt(1, id);
				stmt.executeUpdate();
				stmt.close();
			}
			st = con.createStatement();
			st.execute("PRAGMA foreign_keys = ON");
			st.close();
		} catch (SQLException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	private int emptyShoots(ObservableList<Shoot> shoots) {
		int count = 0;
		for (Shoot shoot : shoots) {
			if (shoot.getFirstname().trim().length() == 0
					&& shoot.getLastname().trim().length() == 0) {
				count++;
			}
		}
		return count;
	}

	private boolean equalShoots(ObservableList<Shoot> first,
			ObservableList<Shoot> second) {
		for (Shoot shoot : first) {
			if (!second.contains(shoot)) {
				return false;
			}
		}
		for (Shoot shoot : second) {
			if (!first.contains(shoot)) {
				return false;
			}
		}
		return true;
	}

	public boolean existRemoteMatches() throws SQLException {
		initRemote();
		PreparedStatement stmt = remoteCon
				.prepareStatement("SELECT count(season) as seasonCount FROM matches WHERE season = ? GROUP BY season");
		stmt.setInt(1, id);
		ResultSet result = stmt.executeQuery();
		if (result.first()) {
			if (result.getInt("seasonCount") > 0) {
				return true;
			}
		}
		stmt.close();

		return false;
	}

	public Set<String> getFirstnames(String team) {
		Set<String> firstnames = new HashSet<String>();
		try {
			PreparedStatement stmt = con
					.prepareStatement("SELECT DISTINCT firstname FROM shoot WHERE team = ?");
			stmt.setString(1, team);
			ResultSet query = stmt.executeQuery();
			query.next();
			while (!query.isAfterLast()) {
				firstnames.add(query.getString("firstname"));
				query.next();
			}
			query.close();
			stmt.close();

		} catch (SQLException e) {
			e.printStackTrace();
		}

		return firstnames;
	}

	public Set<String> getLastnames(String team) {
		Set<String> lastnames = new HashSet<String>();
		try {
			PreparedStatement stmt = con
					.prepareStatement("SELECT DISTINCT lastname FROM shoot WHERE team = ?");
			stmt.setString(1, team);
			ResultSet query = stmt.executeQuery();
			query.next();
			while (!query.isAfterLast()) {
				lastnames.add(query.getString("lastname"));
				query.next();
			}
			query.close();
			stmt.close();

		} catch (SQLException e) {
			e.printStackTrace();
		}

		return lastnames;
	}

	public Season getSeason() {
		return season;
	}

	public ShootingAdministration getSeason(int id) {
		try {
			System.out.println("i: " + id);
			this.id = id;

			// get Label and year
			PreparedStatement stmt = con
					.prepareStatement("SELECT year, label FROM season WHERE season = ?;");
			stmt.setInt(1, id);
			ResultSet rows = stmt.executeQuery();
			int year = rows.getInt("year");
			String label = rows.getString("label");
			stmt.close();
			rows.close();

			// Get Configs
			HashMap<String, String> config = new HashMap<>();
			stmt = con
					.prepareStatement("SELECT configkey, configvalue FROM seasonconfig WHERE season = ?;");
			stmt.setInt(1, id);
			rows = stmt.executeQuery();
			rows.next();
			while (!rows.isAfterLast()) {
				config.put(rows.getString("configkey"),
						rows.getString("configvalue"));
				rows.next();
			}
			stmt.close();
			rows.close();

			// Get teams
			stmt = con
					.prepareStatement("SELECT name, trainingday, trainingtime, location, contact, phone FROM team WHERE season = ?;");
			stmt.setInt(1, id);
			rows = stmt.executeQuery();
			ObservableList<Team> teams = FXCollections.observableArrayList();
			rows.next();
			while (!rows.isAfterLast()) {
				teams.add(new Team(rows.getString("name"), rows
						.getString("trainingday"), rows
						.getString("trainingtime"), rows.getString("location"),
						rows.getString("contact"), rows.getString("phone")));
				rows.next();
			}
			stmt.close();
			rows.close();

			// Get matches
			stmt = con
					.prepareStatement("SELECT hometeam, guestteam, week FROM match WHERE season = ?;");
			stmt.setInt(1, id);
			rows = stmt.executeQuery();
			ObservableList<Match> matches = FXCollections.observableArrayList();
			rows.next();
			PreparedStatement shoots = con
					.prepareStatement("SELECT firstname, lastname, team, startid, endid, agegroup, result FROM shoot WHERE season = ? AND hometeam = ? AND guestteam = ?;");
			PreparedStatement addShoots = con
					.prepareStatement("SELECT firstname, lastname, team, startid, endid, agegroup, result FROM additionalshoot WHERE season = ? AND hometeam = ? AND guestteam = ?;");
			while (!rows.isAfterLast()) {

				String hometeam = rows.getString("hometeam");
				String guestteam = rows.getString("guestteam");
				int week = rows.getInt("week");
				ObservableList<Shoot> homeShoots = FXCollections
						.observableArrayList();
				ObservableList<Shoot> guestShoots = FXCollections
						.observableArrayList();
				shoots.setInt(1, id);
				shoots.setString(2, hometeam);
				shoots.setString(3, guestteam);
				ResultSet shootRows = shoots.executeQuery();

				if (shootRows.next()) {
					while (!shootRows.isAfterLast()) {
						Shoot shoot = new Shoot(
								shootRows.getString("firstname"),
								shootRows.getString("lastname"),
								shootRows.getInt("startid"),
								shootRows.getInt("endid"),
								shootRows.getString("agegroup"),
								shootRows.getDouble("result"));
						String team = shootRows.getString("team");
						System.out.println(shoot);
						if (team.equals(hometeam)) {
							homeShoots.add(shoot);
						} else {
							guestShoots.add(shoot);
						}
						shootRows.next();
					}
				}

				ObservableList<Shoot> addHomeShoots = FXCollections
						.observableArrayList();
				ObservableList<Shoot> addGuestShoots = FXCollections
						.observableArrayList();

				addShoots.setInt(1, id);
				addShoots.setString(2, hometeam);
				addShoots.setString(3, guestteam);
				ResultSet addShootRows = addShoots.executeQuery();

				if (addShootRows.next()) {
					while (!addShootRows.isAfterLast()) {
						Shoot shoot = new Shoot(
								addShootRows.getString("firstname"),
								addShootRows.getString("lastname"),
								addShootRows.getInt("startid"),
								addShootRows.getInt("endid"),
								addShootRows.getString("agegroup"),
								addShootRows.getDouble("result"));
						String team = addShootRows.getString("team");
						if (team.equals(hometeam)) {
							addHomeShoots.add(shoot);
						} else {
							addGuestShoots.add(shoot);
						}
						addShootRows.next();
					}
				}

				int border = 4 - homeShoots.size();
				for (int i = 0; i < border; i++) {
					homeShoots.add(new Shoot("", "", -1, -1, "Schützenklasse",
							0));
				}
				border = 4 - guestShoots.size();
				for (int i = 0; i < border; i++) {
					guestShoots.add(new Shoot("", "", -1, -1, "Schützenklasse",
							0));
				}
				Match m = new Match(getTeam(hometeam, teams), getTeam(
						guestteam, teams), week, homeShoots, guestShoots);
				m.setAddGuestShoots(addGuestShoots);
				m.setAddHomeShoots(addHomeShoots);
				matches.add(m);
				shootRows.close();

				rows.next();

			}

			shoots.close();
			addShoots.close();

			stmt.close();
			rows.close();
			stmt = con
					.prepareStatement("SELECT week, date FROM dates WHERE season = ?;");
			stmt.setInt(1, id);
			rows = stmt.executeQuery();
			rows.next();
			ObservableList<SimpleStringProperty> dates = FXCollections
					.observableArrayList();
			while (!rows.isAfterLast()) {
				SimpleStringProperty strProperty = new SimpleStringProperty(
						rows.getString("date"));
				dates.add(rows.getInt("week"), strProperty);
				;
				rows.next();
			}
			stmt.close();
			rows.close();

			stmt.close();

			Season season = new Season(year, label, teams, matches, dates,
					config);

			setSeason(season);
			System.out.println("Seasons");
			for (Match match : season.matches) {
				System.out.println(match.getHometeam() + "("
						+ match.getHomeScore() + ") vs. "
						+ match.getGuestteam() + "(" + match.getGuestScore()
						+ ")");
			}
			setShootingAdmin(new ShootingAdministration(season));
			shootingAdmin.refreshSorting();

			return shootingAdmin;
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return null;
	}

	public ObservableList<SeasonRow> getSeasonRows() {
		return seasonRows;
	}

	public ShootingAdministration getShootingAdmin() {
		return shootingAdmin;
	}

	public Team getTeam(String teamName, ObservableList<Team> teams) {
		for (Team team : teams) {
			if (teamName.equals(team.getName())) {
				return team;
			}
		}
		return null;
	}

	public ObservableList<User> getUsers() throws SQLException {
		initRemote();
		ObservableList<User> users = FXCollections.observableArrayList();
		Statement stmt = remoteCon
				.createStatement();
		ResultSet result = stmt.executeQuery("SELECT realname, password, salt, email FROM users;");
		if (result.next()) {
			while (!result.isAfterLast()) {
				users.add(new User(result.getString("email"), result
						.getString("realname"), result.getString("password"),
						result.getString("salt")));
				result.next();
			}
		}

		return users;
	}

	public ObservableList<Responsible> getUserTeamMatching()
			throws SQLException {
		initRemote();
		ObservableList<Responsible> resp = FXCollections.observableArrayList();
		PreparedStatement stmt = remoteCon
				.prepareStatement("SELECT team, u.email as email, realname as name FROM users u JOIN responsible r ON (u.email = r.email) WHERE season = ?");
		stmt.setInt(1, id);
		ResultSet result = stmt.executeQuery();
		if (result.first()) {
			while (!result.isAfterLast()) {
				resp.add(new Responsible(result.getString("name"), result
						.getString("email"), result.getString("team")));
				result.next();
			}
		}

		return resp;
	}

	public void refresh() {
		season.removeZeroScores();
		shootingAdmin.refreshSorting();
	}

	public void setSeason(Season season) {
		this.season = season;
	}

	public void setSeasonRows(ObservableList<SeasonRow> seasonRows) {
		this.seasonRows = seasonRows;
	}

	public void setShootingAdmin(ShootingAdministration shootingAdmin) {
		this.shootingAdmin = shootingAdmin;
	}

	public boolean setUsers(ObservableList<User> users) throws SQLException {
		initRemote();
		remoteCon.setAutoCommit(false);
		Statement stmtDel = remoteCon.createStatement();
		stmtDel.executeUpdate("DELETE FROM users;");
		PreparedStatement stmt = remoteCon
				.prepareStatement("INSERT INTO users(realname, email, password, salt) VALUES (?,?,?,?);");
		for (User user : users) {
			System.out.println(user.getPassword());
			stmt.setString(1, user.getName());
			stmt.setString(2, user.getEmail());
			stmt.setString(3, user.getPassword());
			stmt.setString(4, user.getSalt());
			stmt.executeUpdate();
		}
		remoteCon.commit();
		return true;
	}

	public boolean setUserTeamMatching(
			ObservableList<Responsible> userTeamMatches) throws SQLException {
		initRemote();
		remoteCon.setAutoCommit(false);
		PreparedStatement stmt = remoteCon
				.prepareStatement("DELETE FROM responsible WHERE season = ?;");
		stmt.setInt(1, id);
		stmt.executeUpdate();
		stmt = remoteCon
				.prepareStatement("INSERT INTO responsible(email, team, season) VALUES (?,?,?);");
		for (Responsible userTeam : userTeamMatches) {
			stmt.setString(1, userTeam.getEmail());
			stmt.setString(2, userTeam.getTeam());
			stmt.setInt(3, id);
			stmt.executeUpdate();
		}
		remoteCon.commit();
		return true;

	}

	public void startRemoteTransaction() throws SQLException {
		initRemote();
		remoteCon.setAutoCommit(false);
	}

	public ObservableList<ObservableList<Shoot>> tryFastforward(Match match,
			String team) throws SQLException {
		initRemote();
		PreparedStatement changedQuery = remoteCon
				.prepareStatement("SELECT changed FROM matches WHERE hometeam = ? AND guestteam = ? AND season = ?;");
		changedQuery.setString(1, match.getHometeam());
		changedQuery.setString(2, match.getGuestteam());
		changedQuery.setInt(3, id);
		ResultSet result = changedQuery.executeQuery();
		result.next();
		int changed = result.getInt("changed");
		changedQuery.close();

		ObservableList<Shoot> remoteShoots = FXCollections
				.observableArrayList();
		PreparedStatement shoots = remoteCon
				.prepareStatement("SELECT firstname, lastname, agegroup, startid, endid, result "
						+ "FROM shoots s join matches m ON (s.hometeam = m.hometeam AND s.guestteam = m.guestteam AND s.season = m.season) "
						+ "WHERE m.hometeam = ? AND m.guestteam = ? AND team = ? AND m.season = ?");
		shoots.setString(1, match.getHometeam());
		shoots.setString(2, match.getGuestteam());
		shoots.setString(3, team);
		shoots.setInt(4, id);
		result = shoots.executeQuery();

		if (result.next()) {
			while (!result.isAfterLast()) {
				remoteShoots.add(new Shoot(result.getString("firstname"),
						result.getString("lastname"), result.getInt("startid"),
						result.getInt("endid"), result.getString("agegroup"),
						result.getDouble("result")));
				result.next();
			}
		}

		ObservableList<Shoot> remoteAdditionalShoots = FXCollections
				.observableArrayList();
		PreparedStatement additionalShoots = remoteCon
				.prepareStatement("SELECT firstname, lastname, agegroup, startid, endid, result "
						+ "FROM additionalshoots s join matches m ON (s.hometeam = m.hometeam AND s.guestteam = m.guestteam AND s.season = m.season) "
						+ "WHERE m.hometeam = ? AND m.guestteam = ? AND team = ? AND m.season = ?");
		additionalShoots.setString(1, match.getHometeam());
		additionalShoots.setString(2, match.getGuestteam());
		additionalShoots.setString(3, team);
		additionalShoots.setInt(4, id);
		result = additionalShoots.executeQuery();

		if (result.next()) {
			while (!result.isAfterLast()) {
				remoteAdditionalShoots.add(new Shoot(result
						.getString("firstname"), result.getString("lastname"),
						result.getInt("startid"), result.getInt("endid"),
						result.getString("agegroup"), result
								.getDouble("result")));
				result.next();
			}
		}
		shoots.close();
		additionalShoots.close();
		ObservableList<Shoot> localShoots = team.equals(match.getHometeam()) ? match
				.getHomeShoots() : match.getGuestShoots();
		ObservableList<Shoot> additionalLocalShoots = team.equals(match
				.getHometeam()) ? match.getAddHomeShoots() : match
				.getAddGuestShoots();
		for (int i = remoteShoots.size(); i < 4; i++) {
			remoteShoots.add(new Shoot("", "", -1, -1, "Schützenklasse", 0));
		}
		int remoteEmpty = emptyShoots(remoteShoots);
		int localEmpty = emptyShoots(localShoots);
		if (remoteEmpty == 4 && localEmpty == 4
				&& additionalLocalShoots.size() == 0
				&& remoteAdditionalShoots.size() == 0) {
			return null;
		} else if (equalShoots(remoteShoots, localShoots)
				&& equalShoots(additionalLocalShoots, remoteAdditionalShoots)) {
			return null;
		} else if (remoteEmpty == 4 && remoteAdditionalShoots.size() == 0) {
			UpdateMatchToRemote(match);
			return null;
		} else if (localEmpty == 4 && additionalLocalShoots.size() == 0) {
			for (int i = 0; i < 4; i++) {
				Shoot localShoot = localShoots.get(i);
				Shoot remoteShoot = remoteShoots.get(i);
				localShoot.setFirstname(remoteShoot.getFirstname());
				localShoot.setLastname(remoteShoot.getLastname());
				localShoot.setAgegroup(remoteShoot.getAgegroup());
				localShoot.setStartID(remoteShoot.getStartID());
				localShoot.setEndID(remoteShoot.getEndID());
				localShoot.setScore(remoteShoot.getScore());
			}
			additionalLocalShoots.clear();
			for (Shoot remoteShoot : remoteAdditionalShoots) {
				Shoot localShoot = getSeason().getNewAditionalShoot(match,
						team.equals(match.getHometeam()));
				localShoot.setFirstname(remoteShoot.getFirstname());
				localShoot.setLastname(remoteShoot.getLastname());
				localShoot.setAgegroup(remoteShoot.getAgegroup());
				localShoot.setStartID(remoteShoot.getStartID());
				localShoot.setEndID(remoteShoot.getEndID());
				localShoot.setScore(remoteShoot.getScore());
				additionalLocalShoots.add(localShoot);
			}
			updateMatch(match);
			return null;
		} else {
			ObservableList<ObservableList<Shoot>> list = FXCollections
					.observableArrayList();
			list.add(remoteShoots);
			list.add(remoteAdditionalShoots);
			return list;
		}
	}

	public void unchangeMatch(Match match) throws SQLException {
		PreparedStatement matchChanged = remoteCon
				.prepareStatement("UPDATE matches SET changed = 0 WHERE hometeam = ? AND guestteam = ? AND season = ?;");
		matchChanged.setString(1, match.getHometeam());
		matchChanged.setString(2, match.getGuestteam());
		matchChanged.setInt(3, id);
		matchChanged.executeUpdate();
		matchChanged.close();
	}

	public void updateAdminRemote() throws SQLException {
		initRemote();
		PreparedStatement updateAdmin = remoteCon
				.prepareStatement("UPDATE admins SET email = ? WHERE AND season = ?;");

		updateAdmin.setString(1, season.getContactMail());
		updateAdmin.setInt(2, id);
		updateAdmin.executeUpdate();
		updateAdmin.close();

	}

	public void updateDates(List<WeekToDateElement> elements) {
		for (int i = 0; i < elements.size(); i++) {
			try {
				season.getDates().get(i).set(elements.get(i).getDate());
				PreparedStatement stmt = con
						.prepareStatement("UPDATE dates SET date = ? WHERE week = ? AND season = ?");
				stmt.setString(1, elements.get(i).getDate());
				stmt.setInt(2, i);
				stmt.setInt(3, id);
				stmt.executeUpdate();
				stmt.close();
			} catch (SQLException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
		}
	}

	public void updateDatesRemote() throws SQLException {
		initRemote();
		PreparedStatement insertDates = remoteCon
				.prepareStatement("UPDATE dates SET date = ? WHERE  week = ? AND season = ?;");
		DateTimeFormatter remoteFormatter = DateTimeFormatter
				.ofPattern("yyyy-MM-dd");
		DateTimeFormatter localFormatter = DateTimeFormatter
				.ofPattern("dd.MM.yyyy");

		for (int i = 0; i < season.getMaxWeek(); i++) {
			String date = season.dates.get(i).get();
			insertDates.setString(
					1,
					date.trim().length() > 0 ? remoteFormatter
							.format(localFormatter.parse(date))
							: remoteFormatter.format(LocalDate.now()));
			insertDates.setInt(2, i + 1);
			insertDates.setInt(3, id);
			insertDates.executeUpdate();
		}
		insertDates.close();
	}

	public void updateInfo(String person, String mail, String info) {
		try {
			PreparedStatement stmt = con
					.prepareStatement("UPDATE seasonconfig SET configvalue = ? WHERE configkey = ? AND season = ?");
			stmt.setString(1, info);
			stmt.setString(2, "infoBox");
			stmt.setInt(3, id);
			stmt.executeUpdate();
			stmt.close();
			season.setInfoBox(info);

			stmt = con
					.prepareStatement("UPDATE seasonconfig SET configvalue = ? WHERE configkey = ? AND season = ?");
			stmt.setString(1, mail);
			stmt.setString(2, "contactMail");
			stmt.setInt(3, id);
			stmt.executeUpdate();
			stmt.close();
			season.setContactMail(mail);

			stmt = con
					.prepareStatement("UPDATE seasonconfig SET configvalue = ? WHERE configkey = ? AND season = ?");
			stmt.setString(1, person);
			stmt.setString(2, "contactPerson");
			stmt.setInt(3, id);
			stmt.executeUpdate();
			stmt.close();
			season.setContactPerson(person);
		} catch (SQLException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public void updateMatch(Match match) {
		try {

			PreparedStatement delete = con
					.prepareStatement("DELETE FROM shoot WHERE hometeam = ? AND guestteam = ? AND season = ?");
			delete.setString(1, match.getHometeam());
			delete.setString(2, match.getGuestteam());
			delete.setInt(3, id);
			delete.executeUpdate();
			delete.close();

			PreparedStatement addelete = con
					.prepareStatement("DELETE FROM additionalshoot WHERE hometeam = ? AND guestteam = ? AND season = ?");
			addelete.setString(1, match.getHometeam());
			addelete.setString(2, match.getGuestteam());
			addelete.setInt(3, id);
			addelete.executeUpdate();
			addelete.close();

			PreparedStatement insert = con
					.prepareStatement("INSERT INTO shoot(hometeam, guestteam, season, firstname, lastname, agegroup, team, startid, endid, result) VALUES (?, ?, ?, ? ,? , ?, ?, ?, ?, ?)");

			for (Shoot shoot : match.getHomeShoots()) {
				if (shoot.getFirstname().trim().length() > 0
						&& shoot.getLastname().trim().length() > 0) {

					insert.setString(1, match.getHometeam());
					insert.setString(2, match.getGuestteam());
					insert.setInt(3, id);
					insert.setString(4, shoot.getFirstname());
					insert.setString(5, shoot.getLastname());
					insert.setString(6, shoot.getAgegroup());
					insert.setString(7, match.getHometeam());
					insert.setInt(8, shoot.getStartID());
					insert.setInt(9, shoot.getEndID());
					insert.setDouble(10, shoot.getScore());
					insert.executeUpdate();
				}
			}
			for (Shoot shoot : match.getGuestShoots()) {
				if (shoot.getFirstname().trim().length() > 0
						&& shoot.getLastname().trim().length() > 0) {
					insert.setString(1, match.getHometeam());
					insert.setString(2, match.getGuestteam());
					insert.setInt(3, id);
					insert.setString(4, shoot.getFirstname());
					insert.setString(5, shoot.getLastname());
					insert.setString(6, shoot.getAgegroup());
					insert.setString(7, match.getGuestteam());
					insert.setInt(8, shoot.getStartID());
					insert.setInt(9, shoot.getEndID());
					insert.setDouble(10, shoot.getScore());
					insert.executeUpdate();
				}
			}
			insert.close();

			PreparedStatement insertAdd = con
					.prepareStatement("INSERT INTO additionalshoot(hometeam, guestteam, season, firstname, lastname, agegroup, team, startid, endid, result) VALUES (?, ?, ?, ? ,? , ?, ?, ?, ?, ?)");

			for (Shoot shoot : match.getAddHomeShoots()) {
				if (shoot.getFirstname().trim().length() > 0
						&& shoot.getLastname().trim().length() > 0) {

					insertAdd.setString(1, match.getHometeam());
					insertAdd.setString(2, match.getGuestteam());
					insertAdd.setInt(3, id);
					insertAdd.setString(4, shoot.getFirstname());
					insertAdd.setString(5, shoot.getLastname());
					insertAdd.setString(6, shoot.getAgegroup());
					insertAdd.setString(7, match.getHometeam());
					insertAdd.setInt(8, shoot.getStartID());
					insertAdd.setInt(9, shoot.getEndID());
					insertAdd.setDouble(10, shoot.getScore());
					insertAdd.executeUpdate();
				}
			}
			for (Shoot shoot : match.getAddGuestShoots()) {
				if (shoot.getFirstname().trim().length() > 0
						&& shoot.getLastname().trim().length() > 0) {
					insertAdd.setString(1, match.getHometeam());
					insertAdd.setString(2, match.getGuestteam());
					insertAdd.setInt(3, id);
					insertAdd.setString(4, shoot.getFirstname());
					insertAdd.setString(5, shoot.getLastname());
					insertAdd.setString(6, shoot.getAgegroup());
					insertAdd.setString(7, match.getGuestteam());
					insertAdd.setInt(8, shoot.getStartID());
					insertAdd.setInt(9, shoot.getEndID());
					insertAdd.setDouble(10, shoot.getScore());
					insertAdd.executeUpdate();
				}
			}

			insertAdd.close();
		} catch (SQLException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public void UpdateMatchToRemote(Match match) throws SQLException {
		initRemote();
		boolean done = emptyShoots(match.getHomeShoots()) <= 1
				&& emptyShoots(match.getGuestShoots()) <= 1;
		PreparedStatement matchChanged = remoteCon
				.prepareStatement("UPDATE matches SET done = ? WHERE hometeam = ? AND guestteam = ? AND season = ?;");
		matchChanged.setInt(1, done ? 1 : 0);
		matchChanged.setString(2, match.getHometeam());
		matchChanged.setString(3, match.getGuestteam());
		matchChanged.setInt(4, id);
		matchChanged.executeUpdate();
		matchChanged.close();

		PreparedStatement delete = remoteCon
				.prepareStatement("DELETE FROM shoots WHERE hometeam = ? AND guestteam = ? AND season = ?");
		delete.setString(1, match.getHometeam());
		delete.setString(2, match.getGuestteam());
		delete.setInt(3, id);
		delete.executeUpdate();
		PreparedStatement additionalDelete = remoteCon
				.prepareStatement("DELETE FROM additionalshoots WHERE hometeam = ? AND guestteam = ? AND season = ?");
		additionalDelete.setString(1, match.getHometeam());
		additionalDelete.setString(2, match.getGuestteam());
		additionalDelete.setInt(3, id);
		additionalDelete.executeUpdate();

		PreparedStatement insert = remoteCon
				.prepareStatement("INSERT INTO shoots(hometeam, guestteam, season, firstname, lastname, agegroup, team, startid, endid, result) VALUES (?, ?, ?, ? ,? , ?, ?, ?, ?, ?)");

		PreparedStatement insertadditionalShoot = remoteCon
				.prepareStatement("INSERT INTO additionalshoots(hometeam, guestteam, season, firstname, lastname, agegroup, "
						+ "team, startid, endid, result) "
						+ "VALUES(?,?,?,?,?,?,?,?,?,?)");
		for (Shoot shoot : match.getHomeShoots()) {
			if (shoot.getFirstname().trim().length() > 0
					&& shoot.getLastname().trim().length() > 0) {

				insert.setString(1, match.getHometeam());
				insert.setString(2, match.getGuestteam());
				insert.setInt(3, id);
				insert.setString(4, shoot.getFirstname());
				insert.setString(5, shoot.getLastname());
				insert.setString(6, shoot.getAgegroup());
				insert.setString(7, match.getHometeam());
				insert.setInt(8, shoot.getStartID());
				insert.setInt(9, shoot.getEndID());
				insert.setDouble(10, shoot.getScore());
				insert.executeUpdate();
			}
		}
		for (Shoot shoot : match.getGuestShoots()) {
			if (shoot.getFirstname().trim().length() > 0
					&& shoot.getLastname().trim().length() > 0) {
				insert.setString(1, match.getHometeam());
				insert.setString(2, match.getGuestteam());
				insert.setInt(3, id);
				insert.setString(4, shoot.getFirstname());
				insert.setString(5, shoot.getLastname());
				insert.setString(6, shoot.getAgegroup());
				insert.setString(7, match.getGuestteam());
				insert.setInt(8, shoot.getStartID());
				insert.setInt(9, shoot.getEndID());
				insert.setDouble(10, shoot.getScore());
				insert.executeUpdate();
			}
		}

		for (Shoot shoot : match.getAddGuestShoots()) {
			if (shoot.getFirstname().trim().length() > 0) {
				insertadditionalShoot.setString(1, match.getHometeam());
				insertadditionalShoot.setString(2, match.getGuestteam());
				insertadditionalShoot.setInt(3, id);
				insertadditionalShoot.setString(4, shoot.getFirstname());
				insertadditionalShoot.setString(5, shoot.getLastname());
				insertadditionalShoot.setString(6, shoot.getAgegroup());
				insertadditionalShoot.setString(7, match.getGuestteam());
				insertadditionalShoot.setInt(8, shoot.getStartID());
				insertadditionalShoot.setInt(9, shoot.getEndID());
				insertadditionalShoot.setDouble(10, shoot.getScore());
				insertadditionalShoot.executeUpdate();
			}
		}

		for (Shoot shoot : match.getAddHomeShoots()) {
			if (shoot.getFirstname().trim().length() > 0) {
				insertadditionalShoot.setString(1, match.getHometeam());
				insertadditionalShoot.setString(2, match.getGuestteam());
				insertadditionalShoot.setInt(3, id);
				insertadditionalShoot.setString(4, shoot.getFirstname());
				insertadditionalShoot.setString(5, shoot.getLastname());
				insertadditionalShoot.setString(6, shoot.getAgegroup());
				insertadditionalShoot.setString(7, match.getHometeam());
				insertadditionalShoot.setInt(8, shoot.getStartID());
				insertadditionalShoot.setInt(9, shoot.getEndID());
				insertadditionalShoot.setDouble(10, shoot.getScore());
				insertadditionalShoot.executeUpdate();
			}
		}
		delete.close();
		additionalDelete.close();
		insert.close();
		insertadditionalShoot.close();
	}

	public void updateTeam(Team team, String oldTeamName) {
		try {
			Statement st = con.createStatement();
			st.execute("PRAGMA foreign_keys = OFF");
			st.close();
			PreparedStatement stmt = con
					.prepareStatement("UPDATE team SET name = ?, trainingday = ?, trainingtime = ?, location = ?, contact = ?, phone = ? WHERE name = ? AND season = ?;");

			stmt.setString(1, team.getName());
			stmt.setString(2, team.getTrainingday());
			stmt.setString(3, team.getTrainingtime());
			stmt.setString(4, team.getLocation());
			stmt.setString(5, team.getContact());
			stmt.setString(6, team.getPhone());
			stmt.setString(7, oldTeamName);
			stmt.setInt(8, id);
			stmt.executeUpdate();
			stmt.close();

			if (!oldTeamName.equals(team.getName())) {
				stmt = con
						.prepareStatement("UPDATE match SET hometeam = ? WHERE hometeam = ?;");
				stmt.setString(1, team.getName());
				stmt.setString(2, oldTeamName);
				stmt.executeUpdate();
				stmt.close();

				stmt = con
						.prepareStatement("UPDATE match SET guestteam = ? WHERE guestteam = ?;");
				stmt.setString(1, team.getName());
				stmt.setString(2, oldTeamName);
				stmt.executeUpdate();
				stmt.close();

				stmt = con
						.prepareStatement("UPDATE shoot SET guestteam = ? WHERE guestteam = ?;");
				stmt.setString(1, team.getName());
				stmt.setString(2, oldTeamName);
				stmt.executeUpdate();
				stmt.close();

				stmt = con
						.prepareStatement("UPDATE shoot SET hometeam = ? WHERE hometeam = ?;");
				stmt.setString(1, team.getName());
				stmt.setString(2, oldTeamName);
				stmt.executeUpdate();
				stmt.close();

				stmt = con
						.prepareStatement("UPDATE shoot SET team = ? WHERE team = ?;");
				stmt.setString(1, team.getName());
				stmt.setString(2, oldTeamName);
				stmt.executeUpdate();
				stmt.close();
				addNeedUpdateTeamName(oldTeamName, team.getName());
				try {
					startRemoteTransaction();
					updateTeamNameRemote();
					commitRemoteTransaction();
				} catch (Exception e) {
					System.out
							.println("Can not reach Remote DB. Added Change for next synchronisation");
				}
			}

			st = con.createStatement();
			st.execute("PRAGMA foreign_keys = ON");
			st.close();
			shootingAdmin.refreshSorting();

		} catch (SQLException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public void uploadToRemote() throws SQLException {
		initRemote();
		PreparedStatement insertSesason = remoteCon
				.prepareStatement("INSERT INTO season(season, year, label) VALUES(?,?,?);");
		insertSesason.setInt(1, id);
		insertSesason.setInt(2, season.getYear());
		insertSesason.setString(3, season.getLabel());
		insertSesason.executeUpdate();
		insertSesason.close();
		PreparedStatement insertAdmin = remoteCon
				.prepareStatement("INSERT INTO admins(email, season) VALUES(?,?);");

		insertAdmin.setString(1, season.getContactMail());
		insertAdmin.setInt(2, id);
		insertAdmin.executeUpdate();
		insertAdmin.close();

		PreparedStatement insertMatch = remoteCon
				.prepareStatement("INSERT INTO matches(hometeam, guestteam, season, week, done, changed) "
						+ "VALUES(?,?,?,?,?,0)");
		PreparedStatement insertShoot = remoteCon
				.prepareStatement("INSERT INTO shoots(hometeam, guestteam, season, firstname, lastname, agegroup, "
						+ "team, startid, endid, result) "
						+ "VALUES(?,?,?,?,?,?,?,?,?,?)");

		PreparedStatement insertadditionalShoot = remoteCon
				.prepareStatement("INSERT INTO additionalshoots(hometeam, guestteam, season, firstname, lastname, agegroup, "
						+ "team, startid, endid, result) "
						+ "VALUES(?,?,?,?,?,?,?,?,?,?)");
		for (Match match : season.getMatches()) {
			boolean done = emptyShoots(match.getHomeShoots()) <= 1
					&& emptyShoots(match.getGuestShoots()) <= 1;

			insertMatch.setString(1, match.getHometeam());
			insertMatch.setString(2, match.getGuestteam());
			insertMatch.setInt(3, id);
			insertMatch.setInt(4, match.getWeek());
			insertMatch.setInt(5, done ? 1 : 0);
			insertMatch.executeUpdate();

			insertShoot.setString(1, match.getHometeam());
			insertShoot.setString(2, match.getGuestteam());
			insertShoot.setInt(3, id);

			for (Shoot shoot : match.getHomeShoots()) {
				if (shoot.getFirstname().trim().length() > 0) {
					insertShoot.setString(4, shoot.getFirstname());
					insertShoot.setString(5, shoot.getLastname());
					insertShoot.setString(6, shoot.getAgegroup());
					insertShoot.setString(7, match.getHometeam());
					insertShoot.setInt(8, shoot.getStartID());
					insertShoot.setInt(9, shoot.getEndID());
					insertShoot.setDouble(10, shoot.getScore());
					insertShoot.executeUpdate();
				}
			}

			for (Shoot shoot : match.getGuestShoots()) {
				if (shoot.getFirstname().trim().length() > 0) {
					insertShoot.setString(4, shoot.getFirstname());
					insertShoot.setString(5, shoot.getLastname());
					insertShoot.setString(6, shoot.getAgegroup());
					insertShoot.setString(7, match.getGuestteam());
					insertShoot.setInt(8, shoot.getStartID());
					insertShoot.setInt(9, shoot.getEndID());
					insertShoot.setDouble(10, shoot.getScore());
					insertShoot.executeUpdate();
				}
			}

			for (Shoot shoot : match.getAddGuestShoots()) {
				if (shoot.getFirstname().trim().length() > 0) {
					insertadditionalShoot.setString(1, match.getHometeam());
					insertadditionalShoot.setString(2, match.getGuestteam());
					insertadditionalShoot.setInt(3, id);
					insertadditionalShoot.setString(4, shoot.getFirstname());
					insertadditionalShoot.setString(5, shoot.getLastname());
					insertadditionalShoot.setString(6, shoot.getAgegroup());
					insertadditionalShoot.setString(7, match.getGuestteam());
					insertadditionalShoot.setInt(8, shoot.getStartID());
					insertadditionalShoot.setInt(9, shoot.getEndID());
					insertadditionalShoot.setDouble(10, shoot.getScore());
					insertadditionalShoot.executeUpdate();
				}
			}

			for (Shoot shoot : match.getAddHomeShoots()) {
				if (shoot.getFirstname().trim().length() > 0) {
					insertadditionalShoot.setString(1, match.getHometeam());
					insertadditionalShoot.setString(2, match.getGuestteam());
					insertadditionalShoot.setInt(3, id);
					insertadditionalShoot.setString(4, shoot.getFirstname());
					insertadditionalShoot.setString(5, shoot.getLastname());
					insertadditionalShoot.setString(6, shoot.getAgegroup());
					insertadditionalShoot.setString(7, match.getHometeam());
					insertadditionalShoot.setInt(8, shoot.getStartID());
					insertadditionalShoot.setInt(9, shoot.getEndID());
					insertadditionalShoot.setDouble(10, shoot.getScore());
					insertadditionalShoot.executeUpdate();
				}
			}
		}
		insertMatch.close();
		insertShoot.close();
		insertadditionalShoot.close();
		PreparedStatement insertDates = remoteCon
				.prepareStatement("INSERT INTO dates(week, season, date) VALUES (?,?,?);");
		DateTimeFormatter remoteFormatter = DateTimeFormatter
				.ofPattern("yyyy-MM-dd");
		DateTimeFormatter localFormatter = DateTimeFormatter
				.ofPattern("dd.MM.yyyy");

		for (int i = 0; i < season.getMaxWeek(); i++) {
			String date = season.dates.get(i).get();
			insertDates.setString(
					3,
					date.trim().length() > 0 ? remoteFormatter
							.format(localFormatter.parse(date))
							: remoteFormatter.format(LocalDate.now()));
			insertDates.setInt(1, i + 1);
			insertDates.setInt(2, id);
			insertDates.executeUpdate();
		}
		insertDates.close();

	}

	private void addNeedUpdateTeamName(String oldName, String newName)
			throws SQLException {
		int count = Integer.parseInt(getConfiguration("teamNameCount"));
		setConfiguration("teamNameCount", String.valueOf(count + 1));
		PreparedStatement stmt = con
				.prepareStatement("INSERT INTO teamnameneedupdate (changeID, oldName, newName) values (?, ?, ?);");
		stmt.setInt(1, count);
		stmt.setString(2, oldName);
		stmt.setString(3, newName);
		stmt.executeUpdate();
		stmt.close();
	}

	public void updateTeamNameRemote() throws SQLException {
		PreparedStatement stmt = con
				.prepareStatement("SELECT oldname, newName, changeID FROM teamnameneedupdate ORDER BY changeID ASC;");

		ResultSet rows = stmt.executeQuery();
		rows.next();
		while (!rows.isAfterLast()) {
			String oldName = rows.getString("oldName");
			String newName = rows.getString("newName");
			int chnageID = rows.getInt("changeID");
			raplaceTeamnameRemote(oldName, newName);
			PreparedStatement delete = con
					.prepareStatement("DELETE FROM teamnameneedupdate WHERE changeID = ?;");
			delete.setInt(1, chnageID);
			delete.executeUpdate();
			delete.close();
			rows.next();
		}
		stmt.close();
		rows.close();

	}

	private void raplaceTeamnameRemote(String oldName, String newName)
			throws SQLException {

		PreparedStatement stmt = remoteCon
				.prepareStatement("UPDATE matches SET hometeam = ? WHERE hometeam = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();
		stmt.close();

		stmt = remoteCon
				.prepareStatement("UPDATE matches SET guestteam = ? WHERE guestteam = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();
		stmt.close();

		stmt = remoteCon
				.prepareStatement("UPDATE responsible SET team = ? WHERE team = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();
		stmt.close();

		stmt = remoteCon
				.prepareStatement("UPDATE shoots SET guestteam = ? WHERE guestteam = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();
		stmt.close();

		stmt = remoteCon
				.prepareStatement("UPDATE shoots SET hometeam = ? WHERE hometeam = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();
		stmt.close();

		stmt = remoteCon
				.prepareStatement("UPDATE shoots SET team = ? WHERE team = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();

		stmt = remoteCon
				.prepareStatement("UPDATE additionalshoots SET guestteam = ? WHERE guestteam = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();
		stmt.close();

		stmt = remoteCon
				.prepareStatement("UPDATE additionalshoots SET hometeam = ? WHERE hometeam = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();
		stmt.close();

		stmt = remoteCon
				.prepareStatement("UPDATE additionalshoots SET team = ? WHERE team = ?;");
		stmt.setString(1, newName);
		stmt.setString(2, oldName);
		stmt.executeUpdate();

	}

	public Agegroup getAgeGroup(String firstname, String lastname, String team) {
		Agegroup agegroup = null;
		try {
			PreparedStatement stmt = con
					.prepareStatement("SELECT DISTINCT agegroup FROM shoot WHERE team = ? AND firstname = ? AND lastname = ?");
			stmt.setString(1, team);
			stmt.setString(2, firstname);
			stmt.setString(3, lastname);
			ResultSet query = stmt.executeQuery();
			query.next();
			if (!query.isAfterLast()) {
				agegroup = Agegroup.getAgegroup(query.getString("agegroup"));
			}
			query.close();
			stmt.close();

		} catch (SQLException e) {
			e.printStackTrace();
		}
		return agegroup;
	}
}
