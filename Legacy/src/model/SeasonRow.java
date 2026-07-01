package model;

import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public class SeasonRow {
	public final StringProperty label = new SimpleStringProperty();
	public final IntegerProperty year = new SimpleIntegerProperty();
	private int id;
	
	public SeasonRow(int id, String label, int year){
		setId(id);
		setLabel(label);
		setYear(year);
	}
	
	public String getLabel(){
		return label.get();
	}
	
	public void setLabel(String text){
		this.label.set(text);
	}
	
	public int getYear(){
		return year.get();
	}
	
	public void setYear(int year){
		this.year.set(year);
	}

	public int getId() {
		return id;
	}

	public void setId(int id) {
		this.id = id;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		SeasonRow other = (SeasonRow) obj;
		if (id != other.id)
			return false;
		return true;
	}
	
	public String toString(){
		return getLabel() + " " + getYear();
	}

	
}
