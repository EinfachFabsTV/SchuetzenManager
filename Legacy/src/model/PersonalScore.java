package model;

import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public class PersonalScore implements Comparable<PersonalScore>{
	public final SimpleStringProperty shooter = new SimpleStringProperty();
	public final SimpleStringProperty team = new SimpleStringProperty();
	public final SimpleDoubleProperty total = new SimpleDoubleProperty();
	public final SimpleDoubleProperty mean = new SimpleDoubleProperty();
	public ObservableList<SimpleDoubleProperty> scores = FXCollections.observableArrayList();
	private int active = 0;
	
	public PersonalScore(int maxWeek, Team team, String shooter){
		setShooter(shooter);
		setTeam(team.getName());
		this.team.bind(team.name);
		setMean(0);
		for (int i = 1; i <= maxWeek; i++) {
			SimpleDoubleProperty score = new SimpleDoubleProperty();
			score.set(0);
			scores.add(score);
			score.addListener((observable, oldValue, newValue) -> {
				double meanSum = mean.get() * active;
				if(oldValue.doubleValue() == 0 && newValue.doubleValue() > 0){
					active ++;
				} else if(oldValue.doubleValue() > 0 && newValue.doubleValue() == 0){
					active --;
				}
				total.set(total.get() - oldValue.doubleValue() + newValue.doubleValue());
				mean.set((meanSum - oldValue.doubleValue() + newValue.doubleValue()) / active );
			});
		}
	}
	
	public String getShooter(){
		return this.shooter.get();
	}
	
	public void setShooter(String shooter){
		this.shooter.set(shooter);
	}
	
	public String getTeam(){
		return this.team.get();
	}
	
	public void setTeam(String team){
		this.team.set(team);
	}
	
	public double getMean(){
		return roundDouble(this.mean.get());
	}
	
	public void setMean(double mean){
		this.mean.set(mean);
	}
	
	public double getScore(int week){
		return this.scores.get(week - 1).get();
	}
	
	public double getTotal(){
		return total.get();
	}
	
	public void setTotal(double total){
		this.total.set(total);
	}
	
	
	
	public void setScore(int week, double score){
		this.scores.get(week - 1).set(score);
	}
	
	private double roundDouble(double number){
		return ((double) Math.round(number * 10)) / 10.0; 
	}

	@Override
	public int compareTo(PersonalScore o) {
		int res = (int)(o.getTotal() - getTotal());
		if(res == 0){
			res = (int)(o.getMean() - getMean());
			if(res == 0){
				res = getShooter().compareTo(o.getShooter());
				if(res == 0){
					res = getTeam().compareTo(o.getTeam());
				}
			}
		}
		return res;
	}
	
	public String toString(){
		String values =" [";
		for (SimpleDoubleProperty simpleDoubleProperty : scores) {
			values += simpleDoubleProperty.get();
		}
		return getShooter() + values + "]";
	}
	
}
