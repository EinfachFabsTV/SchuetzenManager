package model;

import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;

public class TableRow implements Comparable<TableRow>{
	public final SimpleStringProperty team = new SimpleStringProperty();
	public final SimpleIntegerProperty win = new SimpleIntegerProperty();
	public final SimpleIntegerProperty loose = new SimpleIntegerProperty();
	public final SimpleIntegerProperty tied = new SimpleIntegerProperty();
	public final SimpleDoubleProperty rings = new SimpleDoubleProperty();
	public final SimpleIntegerProperty points = new SimpleIntegerProperty();

	public TableRow(Team team) {
		setTeam(team.getName());
		this.team.bind(team.name);
		setWin(0);
		setLoose(0);
		setTied(0);
		setRings(0);
		setPoints(0);
		
	}

	public String getTeam() {
		return team.get();
	}

	public void setTeam(String team) {
		this.team.set(team);
	}

	public int getWin() {
		return win.get();
	}

	public void setWin(int win) {
		this.win.set(win);
	}
	
	public void increaseWin(){
		this.win.set(this.win.get() + 1);
	}
	
	public void decreaseWin(){
		this.win.set(this.win.get() - 1);
	}
	
	public void increaseLoose(){
		this.loose.set(this.loose.get() + 1);
	}
	
	public void decreaseLoose(){
		this.loose.set(this.loose.get() - 1);
	}
	
	public void increaseTied(){
		this.tied.set(this.tied.get() + 1);
	}
	
	public void decreaseTied(){
		this.tied.set(this.tied.get() - 1);
	}

	public int getLoose() {
		return this.loose.get();
	}

	public void setLoose(int loose) {
		this.loose.set(loose);
	}

	public int getTied() {
		return this.tied.get();
	}

	public void setTied(int tied) {
		this.tied.set(tied);
	}

	public double getRings() {
		return this.rings.get();
	}

	public void setRings(double rings) {
		this.rings.set(rings);
	}

	public int getPoints() {
		return this.points.get();
	}

	public void setPoints(int points) {
		this.points.set(points);
	}
	
	public String toString(){
		return getTeam() + " | " + getWin() + " | " + getLoose() + " | " + getTied() + " | " + getRings() + " | " + getPoints();
	}

	@Override
	public int compareTo(TableRow o) {
		int compare = o.getPoints() - getPoints();
		if(compare == 0){
			compare = (int) (o.getRings() - getRings());
		}
		if(compare == 0){
			compare = getTeam().compareTo(o.getTeam());
		}
		return compare;
	}
}
