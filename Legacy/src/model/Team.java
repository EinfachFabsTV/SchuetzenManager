package model;

import javafx.beans.property.SimpleStringProperty;

public class Team {
	public SimpleStringProperty name = new SimpleStringProperty();
	public SimpleStringProperty trainingday = new SimpleStringProperty();
	public SimpleStringProperty trainingtime = new SimpleStringProperty();
	public SimpleStringProperty location = new SimpleStringProperty();
	public SimpleStringProperty contact = new SimpleStringProperty();
	public SimpleStringProperty phone = new SimpleStringProperty();

	public Team(String name, String trainingday, String trainingtime,
			String location, String contact, String phone) {
		super();
		setName(name);
		setTrainingday(trainingday);
		setTrainingtime(trainingtime);
		setLocation(location);
		setContact(contact);
		setPhone(phone);
	}

	public String getName() {
		return name.get();
	}

	public void setName(String name) {
		this.name.set(name);
		;
	}

	public String getTrainingday() {
		return trainingday.get();
	}

	public void setTrainingday(String trainingday) {
		this.trainingday.set(trainingday);
	}

	public String getTrainingtime() {
		return trainingtime.get();
	}

	public void setTrainingtime(String trainingtime) {
		this.trainingtime.set(trainingtime);
	}

	public String getLocation() {
		return location.get();
	}

	public void setLocation(String location) {
		this.location.set(location);
	}

	public String getContact() {
		return contact.get();
	}

	public void setContact(String contact) {
		this.contact.set(contact);
	}

	public String getPhone() {
		return phone.get();
	}

	public void setPhone(String phone) {
		this.phone.set(phone);
	}

	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + ((contact == null) ? 0 : contact.hashCode());
		result = prime * result
				+ ((location == null) ? 0 : location.hashCode());
		result = prime * result + ((name == null) ? 0 : name.hashCode());
		result = prime * result + ((phone == null) ? 0 : phone.hashCode());
		result = prime * result
				+ ((trainingday == null) ? 0 : trainingday.hashCode());
		result = prime * result
				+ ((trainingtime == null) ? 0 : trainingtime.hashCode());
		return result;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		Team other = (Team) obj;
		if (contact == null) {
			if (other.contact != null)
				return false;
		} else if (!contact.equals(other.contact))
			return false;
		if (location == null) {
			if (other.location != null)
				return false;
		} else if (!location.equals(other.location))
			return false;
		if (name == null) {
			if (other.name != null)
				return false;
		} else if (!name.equals(other.name))
			return false;
		if (phone == null) {
			if (other.phone != null)
				return false;
		} else if (!phone.equals(other.phone))
			return false;
		if (trainingday == null) {
			if (other.trainingday != null)
				return false;
		} else if (!trainingday.equals(other.trainingday))
			return false;
		if (trainingtime == null) {
			if (other.trainingtime != null)
				return false;
		} else if (!trainingtime.equals(other.trainingtime))
			return false;
		return true;
	}

	public String toString(){
		return getName();
	}
	
	

}
