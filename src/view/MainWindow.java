package view;

import java.awt.Desktop;
import java.awt.Dimension;
import java.awt.Toolkit;
import java.io.File;
import java.io.IOException;

import javafx.beans.value.ChangeListener;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.geometry.Insets;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.MenuBar;
import javafx.scene.control.MenuItem;
import javafx.scene.layout.Pane;
import javafx.scene.layout.VBox;
import javafx.stage.FileChooser;
import javafx.stage.Modality;
import javafx.stage.Stage;
import model.Season;
import model.SeasonRow;

import org.controlsfx.control.CheckListView;
import org.controlsfx.control.action.Action;
import org.controlsfx.dialog.Dialog;
import org.controlsfx.dialog.Dialogs;

import pdf.PDFFactory;
import database.Database;

public class MainWindow extends VBox {

	@FXML
	private ListView<SeasonRow> seasons;

	@FXML
	private Pane mainwindow;

	@FXML
	private MenuItem PDFSettings, createPDF, dates, delete;

	@FXML
	private MenuBar menu;

	private Stage stage;

	private PDFFactory pdfFactory = new PDFFactory();

	private Season season;

	private SeasonRow selectedRow;
	private boolean loading = false;

	private  ChangeListener<? super SeasonRow> listener;
	public MainWindow(Stage stage) {
		this.stage = stage;
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(getClass().getResource(
					"MainWindow.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

		// menu.setUseSystemMenuBar(true);

		listener = (observable, oldValue, newValue) -> {
			if(!loading){
				loading = true;
				if (newValue != null) {
					seasons.getSelectionModel().selectedItemProperty().removeListener(listener);
					seasons.setDisable(true);
					ShootingAdministration shootingAdministration = Database
							.getInstance().getSeason(
									newValue.getId());
					season = shootingAdministration
							.getSeason();
					selectedRow = newValue;
					if (shootingAdministration != null) {
						PDFSettings.setDisable(false);
						createPDF.setDisable(false);
						dates.setDisable(false);
						delete.setDisable(false);
						mainwindow.getChildren().clear();
						mainwindow.getChildren().add(
								shootingAdministration);

					}
					seasons.getSelectionModel().selectedItemProperty().addListener(listener);
					seasons.setDisable(false);
				} else {
					mainwindow.getChildren().clear();
					PDFSettings.setDisable(true);
					createPDF.setDisable(true);
					dates.setDisable(true);
					delete.setDisable(true);

				}
				seasons.getSelectionModel().select(newValue);
				loading = false;
			}
		};
		seasons.setItems(Database.getInstance().getSeasonRows());

		seasons.getSelectionModel()
				.selectedItemProperty()
				.addListener(listener );
		System.out.println();

	}

	@FXML
	protected void newSeason() {
		final Stage dialog = new Stage();
		dialog.initModality(Modality.APPLICATION_MODAL);
		dialog.initOwner(stage);
		dialog.setTitle("Neue Kreismeisterschaft erstellen");

		Scene dialogScene = new Scene(new CreateSeason(dialog), 900, 600);
		dialog.setScene(dialogScene);
		dialog.show();
	}

	@FXML
	protected void createPdf() {

		Dialog dlg = new Dialog(stage, "Welche Dokumente sollen in das PDF?");
		dlg.setResizable(false);
		dlg.setIconifiable(false);
		CheckListView<String> pdfPages = new CheckListView<>(FXCollections.observableArrayList(new String[]{"Termine","Gesamtergebnis", "Einzelergebnisse"}));
		ObservableList<Integer> weeks = FXCollections.observableArrayList();
		for (int i = 1; i <= season.getMaxWeek(); i++) {
			weeks.add(i);
		}
		CheckListView<Integer> compititionWeeks = new CheckListView<>(weeks);
		pdfPages.getCheckModel().selectAll();
		pdfPages.setMaxHeight(80);
		VBox vbox = new VBox();
		Label label = new Label("Wettkampfwochen");
		label.setPadding(new Insets(10, 0, 3, 0));
		vbox.getChildren().addAll(pdfPages, label, compititionWeeks);
		dlg.setContent(vbox);
		dlg.getActions().addAll(Dialog.Actions.OK, Dialog.Actions.CANCEL);

		Action response = dlg.show();
		if (response == Dialog.Actions.OK) {
			FileChooser fileChooser = new FileChooser();
			fileChooser.setTitle("Kreismeisterschaft speicher unter");
			fileChooser.setInitialDirectory(new File(System.getProperty("user.home")));
			fileChooser.setInitialFileName( season.getLabel() + " " + season.getYear());
			FileChooser.ExtensionFilter extFilter = new FileChooser.ExtensionFilter(
					"PDF Dateien (*.pdf)", "*.pdf");
			fileChooser.getExtensionFilters().add(extFilter);
			File file = fileChooser.showSaveDialog(stage);
			if (file != null) {


				pdfFactory.createPDF(season, file, pdfPages.getCheckModel().getSelectedItems(), compititionWeeks.getCheckModel().getSelectedItems());
				try {
					Desktop.getDesktop().open(file);
				} catch (IOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}
		}

	}



	@FXML
	protected void close() {
		System.exit(0);
	}

	@FXML
	protected void deleteSeason() {
		Action response = Dialogs
				.create()
				.owner(stage)
				.title("Löschen einer Saison")
				.message(
						"Die Saison " + season.getLabel() + " "
								+ season.getYear() + " soll gelöscht werden?")
				.actions(Dialog.Actions.OK, Dialog.Actions.CANCEL)
				.showConfirm();
		if (response == Dialog.Actions.OK) {
			Database.getInstance().deleteSeason(selectedRow.getId());
			seasons.getItems().remove(selectedRow);

		}

		System.out.println("response: " + response);
	}

	@FXML
	protected void editDateInfo() {
		final Stage dialog = new Stage();
		dialog.initModality(Modality.APPLICATION_MODAL);
		dialog.initOwner(stage);
		dialog.setTitle("PDF Einstellungen");

		Scene dialogScene = new Scene(new EditDateInfo(dialog,
				season.getContactPerson(), season.getContactMail(),
				season.getInfoBox()), 500, 500);
		dialog.setScene(dialogScene);
		dialog.show();
	}

	@FXML
	protected void userAdministration() {
		final Stage dialog = new Stage();
		dialog.initModality(Modality.APPLICATION_MODAL);
		dialog.initOwner(stage);
		dialog.setTitle("Webservice Benutzerverwaltung");

		Scene dialogScene = new Scene(new UserAdministration(dialog));
		dialog.setScene(dialogScene);
		dialog.show();
	}

	@FXML
	protected void datesForWeeks() {
		final Stage dialog = new Stage();
		dialog.initModality(Modality.APPLICATION_MODAL);
		dialog.initOwner(stage);
		dialog.setTitle("Termine Wettkampfwochen");
		Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();

		Scene dialogScene = new Scene(new WeekToDate(season, dialog), 420,
				Math.min(season.getMaxWeek() * 40 + 70, screenSize.height));
		dialog.setScene(dialogScene);
		dialog.show();
	}

	@FXML
	protected void userTeamMatch(){
		final Stage dialog = new Stage();
		dialog.initModality(Modality.APPLICATION_MODAL);
		dialog.initOwner(stage);
		dialog.setTitle("Webservice Benutzer-Mannschaft Zuordnung");
		Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();

		Scene dialogScene = new Scene(new ResponsibleView(season.getTeams(), dialog));
		dialog.setScene(dialogScene);
		dialog.show();
	}

	@FXML
	protected void sync(){
		final Stage dialog = new Stage();
		dialog.initModality(Modality.APPLICATION_MODAL);
		dialog.initOwner(stage);
		dialog.setTitle("Synchronisieren mit Webservice");
		Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();

		Scene dialogScene = new Scene(new Sync(dialog, season.getMatches()));
		dialog.setScene(dialogScene);
		dialog.show();
	}
}
