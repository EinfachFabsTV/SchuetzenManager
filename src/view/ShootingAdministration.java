package view;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.value.ObservableValue;
import javafx.collections.ObservableList;
import javafx.event.EventHandler;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableColumn.CellDataFeatures;
import javafx.scene.control.TableView;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.VBox;
import javafx.stage.Modality;
import javafx.stage.Stage;
import javafx.util.Callback;
import model.Match;
import model.PersonalScore;
import model.Season;
import model.TableRow;
import model.Team;

public class ShootingAdministration extends VBox{
	
	@FXML
	private TableView<TableRow> table;
	
	@FXML
	private TableView<Team> teams;

	@FXML
	private TabPane seasonView;
	
	@FXML
	private TableView<PersonalScore> normalAgeTable, seniorAgeTable;

	private Season season;
	
	public Season getSeason() {
		return season;
	}

	@FXML
	private TabPane matches;

	public ShootingAdministration(Season season){
		this.season = season;
		FXMLLoader fxmlLoader = new FXMLLoader(getClass().getResource(
				"ShootingAdministration.fxml"));
		fxmlLoader.setRoot(this);
		fxmlLoader.setController(this);
		try {
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		teams.setItems(season.getTeams());
		
		teams.setOnMouseClicked(new EventHandler<MouseEvent>() {
			@Override
			public void handle(MouseEvent t) {
				if (t.getClickCount() == 2) {
					Team team = teams.getSelectionModel().getSelectedItem();
					final Stage dialog = new Stage();
					dialog.initModality(Modality.APPLICATION_MODAL);
					dialog.setTitle("Mannschaft bearbeiten");
					Scene dialogScene = new Scene(new EditTeam(team, dialog, season), 420, 260);
					dialog.setScene(dialogScene);
					dialog.show();

				}
			}
		});
		normalAgeTable.setSelectionModel(NoSelectionModel.<TableRow>getNoTableViewSelectionModel(normalAgeTable));
		seniorAgeTable.setSelectionModel(NoSelectionModel.<TableRow>getNoTableViewSelectionModel(seniorAgeTable));
		table.setSelectionModel(NoSelectionModel.<TableRow>getNoTableViewSelectionModel(table));
		table.setItems(season.getTables().get(0));
		
		for (int i = 1; i <= season.getMaxWeek(); i++) {
			Tab tab = new Tab("Woche " + i);
			final int j = i;
			tab.selectedProperty().addListener((observable, oldValue, newValue) -> {
				if(newValue){
					if(tab.getContent() == null){
						tab.setContent(getMatchWeek(j));
					}
				}
			});
			matches.getTabs().add(tab);
		}
		season.removeZeroScores();
		refreshSorting();
		
		normalAgeTable.setItems(season.scores.get(0));
		seniorAgeTable.setItems(season.scores.get(1));

		TableColumn<PersonalScore, Double> week = new TableColumn<>("Wettkampfwoche");

		for (int i = 1; i <= season.getMaxWeek(); i++) {
			final int j = i;
			TableColumn<PersonalScore, Number> col = new TableColumn<PersonalScore, Number>("" + i);
			col.setMaxWidth(75);
			col.setMinWidth(75);
			col.setCellValueFactory(new Callback<CellDataFeatures<PersonalScore, Number>, ObservableValue<Number>>() {
				public ObservableValue<Number> call(
						CellDataFeatures<PersonalScore, Number> param) {
					return param.getValue().scores.get(j - 1);
				}
			});
			week.getColumns().add(col);
		}
		normalAgeTable.getColumns().addAll(week);

		
		week = new TableColumn<>("Wettkampfwoche");

		for (int i = 1; i <= season.getMaxWeek(); i++) {
			final int j = i;
			TableColumn<PersonalScore, Number> col = new TableColumn<PersonalScore, Number>("" + i);
			col.setMaxWidth(75);
			col.setMinWidth(75);
			col.setCellValueFactory(new Callback<CellDataFeatures<PersonalScore, Number>, ObservableValue<Number>>() {
				public ObservableValue<Number> call(
						CellDataFeatures<PersonalScore, Number> param) {
					return param.getValue().scores.get(j - 1);
				}
			});
			week.getColumns().add(col);
		}

		seniorAgeTable.getColumns().addAll(week);
		
	}
	
	
	
	private MatchWeek getMatchWeek(int week) {
		return new MatchWeek(season, week, getMatches(week), season.getTables().get(week));
	}
	
	public List<Match> getMatches(int week) {
		List<Match> matchList = new ArrayList<>();
		for (Match match : season.getMatches()) {
			if (match.getWeek() == week) {
				matchList.add(match);
			}
		}
		return matchList;
	}

	public TableView<TableRow> getTable() {
		return table;
	}
	
	public TableView<Team> getTeams() {
		return teams;
	}
	
	public void refreshSorting(){
		Collections.sort(teams.getItems(), (first, second) -> {return first.getName().compareTo(second.getName());});
		Collections.sort(table.getItems());
		Collections.sort(season.scores.get(0));
		Collections.sort(season.scores.get(1));
		normalAgeTable.getColumns().get(0).setVisible(false);
		normalAgeTable.getColumns().get(0).setVisible(true);
		seniorAgeTable.getColumns().get(0).setVisible(false);
		seniorAgeTable.getColumns().get(0).setVisible(true);
		table.getColumns().get(0).setVisible(false);
		table.getColumns().get(0).setVisible(true);
		teams.getColumns().get(0).setVisible(false);
		teams.getColumns().get(0).setVisible(true);
		
		for (Tab tab : matches.getTabs()) {
			MatchWeek week = (MatchWeek) tab.getContent();
			if(week != null){
				week.refreshSorting();
			}
			
		}
		
	}
	
	public void setTable(TableView<TableRow> table) {
		this.table = table;
	}
	
	public void setTeams(TableView<Team> teams) {
		this.teams = teams;
	}
}
