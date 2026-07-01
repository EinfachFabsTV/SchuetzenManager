package model;

import java.util.ArrayList;
import java.util.Random;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public class RandomRoundRobin {

	private static final int RUNS = 2000;

	private static int c = 0;


	public ScoredResult computeMatches(ObservableList<Team> teams) {

		ScoredResult min = getRandomAssignment(teams);

		for (int i = 0; i < RUNS; i++) {
			ScoredResult current = getRandomAssignment(teams);
			if(current.score < min.score){
				min = current;
			}
		}


		print(min);
		return min;
	}

	private ScoredResult getRandomAssignment(ObservableList<Team> teams){
		ScoredResult result = new ScoredResult();
		result.teams = teams;
		result.matches = FXCollections.observableArrayList();

		result.maxWeek = teams.size() % 2 != 0 ? teams.size()
				: (teams.size() - 1) ;

		boolean[][] against = new boolean[teams.size()][teams.size()];

		Random rnd = new Random();
		int week = 0;
		for (; week < result.maxWeek; week++) {
			ArrayList<Team> teamsTmp = new ArrayList<>(teams);
			while(teamsTmp.size() > 1){
				int nextTeam = rnd.nextInt(teamsTmp.size());
				Team home = teamsTmp.get(nextTeam);
				int homeIdx = getHomeIdx(teams, home);
				int guestIdx = -1;
				Team guest = null;
				int count = 0;
				while(!teamsTmp.contains(guest)){
					count++;
					guestIdx = getRandomGuestIdx(against, homeIdx);
					if(count > 100 || guestIdx == -1){
						return getRandomAssignment(teams);
					}
					guest = teams.get(guestIdx);
				}

				result.matches.add(new Match(home, guest, week + 1));
				teamsTmp.remove(home);
				teamsTmp.remove(guest);
				against[homeIdx][guestIdx] = true;
				against[guestIdx][homeIdx] = true;
			}
		}
		int cap = result.matches.size();
		for (int i = 0; i < cap; i++) {
			Match m = result.matches.get(i);
			result.matches.add(new Match(getTeam(m.getGuestteam(), teams), getTeam(m.getHometeam(), teams), m.getWeek() + result.maxWeek));

		}
		result.maxWeek *= 2;

		setScore(result);
		return result;
	}

	private int getHomeIdx(ObservableList<Team> teams, Team home) {
		for (int i = 0; i < teams.size(); i++) {
			if(teams.get(i).equals(home)){
				return i;
			}
		}
		return -1;
	}



	private Team getTeam(String teamName, ObservableList<Team> teams){
		for (Team team : teams) {
			if (teamName.equals(team.getName())) {
				return team;
			}
		}
		return null;
	}


	private int getRandomGuestIdx(boolean[][] against, int homeIdx){
		Random rnd = new Random();
		for (int i = 0; i <  against[homeIdx].length * 2; i++) {
			int guestIdx = rnd.nextInt( against[homeIdx].length);
			if(homeIdx != guestIdx && !against[homeIdx][guestIdx]){
				return guestIdx;
			}
		}
		for (int guestIdx = 0; guestIdx <  against[homeIdx].length; guestIdx++) {
			if(homeIdx != guestIdx && !against[homeIdx][guestIdx]){
				c++;
				return guestIdx;
			}
		}
		return -1;
	}

	private void setScore(ScoredResult result){
		int count = 0;

		for (int i = 0; i < result.teams.size(); i++) {
			int homeCount = 0;
			int guestCount = 0;
			Team team = result.teams.get(i);
			for (int week = 0; week < result.maxWeek / 2; week++) {
				Match match = result.getMatch(week + 1, team);
				if(match != null){
					if(team.getName().equals(match.getHometeam())){
						homeCount++;
					} else {
						guestCount++;
					}
				}

			}
			count += Math.pow(2, Math.abs(homeCount - guestCount));


		}
		result.score = count;

	}

	private void print(ScoredResult result){
		for (int i = 0; i < result.teams.size(); i++) {
			int homeCount = 0;
			Team team = result.teams.get(i);
			for (int week = 0; week < result.maxWeek / 2; week++) {
				Match match = result.getMatch(week + 1, team);
				if(match != null){
					if(team.getName().equals(match.getHometeam())){
						homeCount++;
					}
				}

			}
			System.out.println(team.getName() + ": " + homeCount );

		}

	}






	public class ScoredResult {

		ObservableList<Match> matches;
		ObservableList<Team> teams;
		int score;
		int maxWeek;

		public Match getMatch(int week, Team team){
			for (Match match : matches) {
				if(week == match.getWeek() && (team.getName().equals(match.getHometeam()) || team.getName().equals(match.getGuestteam()))){
					return match;
				}
			}
			return null;
		}
	}

	public static void main(String[] args) {
		RandomRoundRobin rrr = new RandomRoundRobin();
		ObservableList<Team> teams = FXCollections.observableArrayList();
		for (int i = 0; i < 8; i++) {
			teams.add(new Team("" + i, "", "", "", "", ""));
		}
		long start = System.currentTimeMillis();
		for (int i = 0; i < 10; i++) {
			rrr.computeMatches(teams);
			System.out.println("====");
		}
		long end = System.currentTimeMillis();
		System.out.println("time: " + (end - start));
	}

}
