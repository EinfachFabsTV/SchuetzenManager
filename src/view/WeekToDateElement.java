package view;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.DatePicker;
import javafx.scene.control.Label;
import javafx.scene.layout.GridPane;

public class WeekToDateElement extends GridPane{
	
	@FXML 
	private Label week;
	
	@FXML
	private DatePicker picker;
	DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd.MM.yyyy"); 

	public WeekToDateElement(int week, String date){
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(
					CreateSeason.class.getResource("WeekToDateElement.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

		this.week.setText("Woche " + week);
		System.out.println(date);
		if(date != null && date.length() > 0){
			this.picker.setValue(LocalDate.parse(date, formatter));
		}
		
	}

	public String getDate(){
		String d;
		try {
			d = formatter.format(picker.getValue());
		} catch (Exception e) {
			if(week.getText().endsWith("1")){
				e.printStackTrace();
			}
			return "";
		}
		return d;
	}
}
