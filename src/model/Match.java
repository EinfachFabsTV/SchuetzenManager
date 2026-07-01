package model;

import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;

import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public class Match {
	private static final int NUMBER_OF_SHOOTS = 3;
	public final SimpleStringProperty hometeam = new SimpleStringProperty();
	public final SimpleStringProperty guestteam = new SimpleStringProperty();
	public final SimpleIntegerProperty week = new SimpleIntegerProperty();
	public final SimpleStringProperty date = new SimpleStringProperty();
	public final SimpleDoubleProperty homeScore = new SimpleDoubleProperty();
	public final SimpleDoubleProperty guestScore = new SimpleDoubleProperty();

	private ObservableList<Shoot> homeShoots;
	private ObservableList<Shoot> guestShoots;
	
	private ObservableList<Shoot> addHomeShoots = FXCollections.observableArrayList();
	private ObservableList<Shoot> addGuestShoots = FXCollections.observableArrayList();

	public Match(Team hometeam, Team guestteam, int week) {
		setHometeam(hometeam.getName());
		this.hometeam.bind(hometeam.name);
		setGuestteam(guestteam.getName());
		this.guestteam.bind(guestteam.name);
		setWeek(week);
		homeShoots = FXCollections.observableArrayList();
		guestShoots = FXCollections.observableArrayList();
		for (int i = 0; i < 4; i++) {
			Shoot shoot = new Shoot("", "", -1, -1, "Schützenklasse", 0);
			homeShoots.add(shoot);
			shoot.score.addListener((observable, oldValue, newValue) -> {
				homeScore.set(score(homeShoots));
			});
		}
		for (int i = 0; i < 4; i++) {
			Shoot shoot = new Shoot("", "", -1, -1, "Schützenklasse", 0);
			guestShoots.add(shoot);
			shoot.score.addListener((observable, oldValue, newValue) -> {
				guestScore.set(score(guestShoots));
			});
		}
		
		homeScore.set(score(homeShoots));
		guestScore.set(score(guestShoots));
	}

	private double score(ObservableList<Shoot> shoots) {
		ObservableList<Shoot> sortedShoots = FXCollections.observableArrayList(shoots);
		Collections.sort(sortedShoots, (first, second) -> {
			 return (int) (second.getScore() * 1000 - first.getScore() * 1000);
		});
		double score = 0;
		for (int i = 0; i < NUMBER_OF_SHOOTS; i++) {
			score += sortedShoots.get(i).getScore();
		}
		return score;
	}

	public Match(Team hometeam, Team guestteam, int week,
			ObservableList<Shoot> homeShoots, ObservableList<Shoot> guestShoots) {
		setHometeam(hometeam.getName());
		this.hometeam.bind(hometeam.name);
		setGuestteam(guestteam.getName());
		this.guestteam.bind(guestteam.name);
		setWeek(week);
		this.homeShoots = homeShoots;
		this.guestShoots = guestShoots;
		for (int i = 0; i < 4; i++) {
			Shoot shoot = homeShoots.get(i);
			shoot.score.addListener((observable, oldValue, newValue) -> {
				homeScore.set(score(this.homeShoots));
			});
			homeScore.set(homeScore.get() + shoot.getScore());
		}
		for (int i = 0; i < 4; i++) {
			Shoot shoot = guestShoots.get(i);
			shoot.score.addListener((observable, oldValue, newValue) -> {
				guestScore.set(score(this.guestShoots));
			});
			guestScore.set(guestScore.get() + shoot.getScore());
		}
		homeScore.set(score(homeShoots));
		guestScore.set(score(guestShoots));
	}

	public String getHometeam() {
		return hometeam.get();
	}

	public void setHometeam(String hometeam) {
		this.hometeam.set(hometeam);
	}

	public String getGuestteam() {
		return guestteam.get();
	}

	public void setGuestteam(String guestteam) {
		this.guestteam.set(guestteam);
	}

	public int getWeek() {
		return week.get();
	}

	public void setWeek(int week) {
		this.week.set(week);
	}

	public String getDate() {
		return date.get();
	}

	public String getEndDate() {
		if (getDate().isEmpty()) {
			return "";
		} else {
			DateTimeFormatter dateFormatter = Season.dateFormatter;
			LocalDate date = LocalDate.parse(getDate(), dateFormatter);
			return dateFormatter.format(date.plusDays(6));
		}
	}

	public void setDate(String date) {
		this.date.set(date);
	}

	public double getHomeScore() {
		return homeScore.get();
	}

	public double getGuestScore() {
		return guestScore.get();
	}

	public ObservableList<Shoot> getHomeShoots() {
		return homeShoots;
	}

	public void setHomeShoots(ObservableList<Shoot> homeShoots) {
		this.homeShoots = homeShoots;
	}

	public ObservableList<Shoot> getGuestShoots() {
		return guestShoots;
	}

	public void setGuestShoots(ObservableList<Shoot> guestShoots) {
		this.guestShoots = guestShoots;
	}

	public String getGuestScoreString() {
		NumberFormat format = NumberFormat.getInstance();
		return format.format(getGuestScore());
	}

	public String getHomeScoreString() {
		NumberFormat format = NumberFormat.getInstance();
		return format.format(getHomeScore());
	}

	public String toString() {
		return "Woche " + getWeek() + ": " + getHometeam() + " vs "
				+ getGuestteam();
	}

	public ObservableList<Shoot> getAddHomeShoots() {
		return addHomeShoots;
	}

	public void setAddHomeShoots(ObservableList<Shoot> addHomeShoots) {
		this.addHomeShoots = addHomeShoots;
	}

	public ObservableList<Shoot> getAddGuestShoots() {
		return addGuestShoots;
	}

	public void setAddGuestShoots(ObservableList<Shoot> addGuestShoots) {
		this.addGuestShoots = addGuestShoots;
	}

}
