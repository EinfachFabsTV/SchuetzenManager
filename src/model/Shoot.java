package model;

import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public class Shoot {

	public final SimpleStringProperty firstname = new SimpleStringProperty();
	public final SimpleStringProperty lastname = new SimpleStringProperty();
	public final SimpleIntegerProperty startID = new SimpleIntegerProperty();
	public final SimpleIntegerProperty endID = new SimpleIntegerProperty();
	public final SimpleStringProperty agegroup = new SimpleStringProperty();
	public final SimpleDoubleProperty score = new SimpleDoubleProperty();

	public Shoot(String firstname, String lastname, int startID, int endID,
			String agegroup, double score) {
		super();
		setFirstname(firstname);
		setLastname(lastname);
		setStartID(startID);
		setEndID(endID);
		setAgegroup(agegroup);
		setScore(score);
	}

	public String getFirstname() {
		return firstname.get();
	}

	public String getLastname() {
		return lastname.get();
	}

	public int getStartID() {
		return startID.get();
	}
	
	public String getStartIDString() {
		return getStartID() >= 0 ? String.valueOf(getStartID()) : "";
	}
	
	public String getEndIDString() {
		return getEndID() >= 0 ? String.valueOf(getEndID()) : "";
	}

	public int getEndID() {
		return endID.get();
	}

	public String getAgegroup() {
		return agegroup.get();
	}

	public double getScore() {
		return score.get();
	}

	public void setFirstname(String firstname) {
		this.firstname.set(firstname);
	}

	public void setLastname(String lastname) {
		this.lastname.set(lastname);
	}

	public void setStartID(int startID) {
		this.startID.set(startID);
	}

	public void setEndID(int endID) {
		this.endID.set(endID);
	}

	public void setAgegroup(String agegroup) {
		this.agegroup.set(agegroup);
	}

	public void setScore(double score) {
		this.score.set(score);
	}

	

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		Shoot other = (Shoot) obj;
		if (agegroup == null) {
			if (other.agegroup != null)
				return false;
		} else if (!getAgegroup().equals(other.getAgegroup()))
			return false;
		if (endID == null) {
			if (other.endID != null)
				return false;
		} else if (getEndID() != other.getEndID())
			return false;
		if (firstname == null) {
			if (other.firstname != null)
				return false;
		} else if (!getFirstname().equals(other.getFirstname()))
			return false;
		if (lastname == null) {
			if (other.lastname != null)
				return false;
		} else if (!getLastname().equals(other.getLastname()))
			return false;
		if (score == null) {
			if (other.score != null)
				return false;
		} else if (getScore() != other.getScore())
			return false;
		if (startID == null) {
			if (other.startID != null)
				return false;
		} else if (getStartID() != other.getStartID())
			return false;
		return true;
	}

	public String toString(){
		return getFirstname() + " " + getLastname() + ": "  + getScore();
	}
	
	

}
