package model;

public enum Agegroup {
	SCHUETZENKLASSE("Schützenklasse", 0), SENIOREN("Senioren", 1);
	public static int numberOfElements = 2;
	private String name;
	private int id;
	private Agegroup(String name, int id){
		this.name = name;
		this.id = id;
	}
	
	public static Agegroup getAgegroup(String name){
		Agegroup[] agegroups = values();
		for (int i = 0; i < agegroups.length; i++) {
			if(agegroups[i].name.equals(name)){
				return agegroups[i];
			}
		}
		return null;
	}
	
	public String toString(){
		return name;
	}
	
	public int getID(){
		return id;
	}

}
